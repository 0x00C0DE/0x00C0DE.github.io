"""Publish PROPRTS interval history without redeploying GitHub Pages.

The uploader writes an atomic snapshot to the dedicated ``bitcoin-data``
branch.  That branch is intentionally different from the Pages source branch,
so frequent data updates do not start a full site build and deployment.

Run continuously:

    python scripts/upload_bitcoin_history.py

Validate configuration without changing GitHub:

    python scripts/upload_bitcoin_history.py --dry-run
"""

from __future__ import annotations

import argparse
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
import logging
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
import tempfile
import time
from typing import Callable, Iterator, List, Optional, Set


UPLOAD_INTERVAL_MINUTES = 10.0
SOURCE_DIRECTORY = (
    Path.home() / "Downloads" / "robinhood_crypto_bot-main" / "proprts-v1"
)
LOCAL_REPOSITORY = Path.home() / "Downloads" / "0x00C0DE.bitcoin-data"
REPOSITORY_URL = "https://github.com/0x00C0DE/0x00C0DE.github.io.git"
BRANCH = "bitcoin-data"
PAGES_BRANCH = "main"
DESTINATION_FOLDER = "bitcoindata"
COMMAND_TIMEOUT_SECONDS = 90.0
NETWORK_ATTEMPTS = 4
RETRY_BASE_SECONDS = 2.0
MAINTENANCE_EVERY_UPLOADS = 6

UNLIMITED_INTERVAL_FILE_RE = re.compile(
    r"^PROPRTS-job_\d+(?:m|h|d|w)-unlimited-history\.txt$", re.IGNORECASE
)
COMMIT_SHA_RE = re.compile(r"^[0-9a-f]{40}$", re.IGNORECASE)
TRANSIENT_ERROR_RE = re.compile(
    r"(?:\b(?:408|429|500|502|503|504)\b|timed? out|timeout|connection reset|"
    r"connection aborted|could not resolve host|failed to connect|remote end hung up|"
    r"unexpected disconnect|temporarily unavailable|service unavailable|try again)",
    re.IGNORECASE,
)
LOGGER = logging.getLogger("bitcoin-history-uploader")


class UploadError(RuntimeError):
    """An actionable uploader or Git error."""


@dataclass(frozen=True)
class UploadConfig:
    source_directory: Path
    local_repository: Path
    repository_url: str
    branch: str
    pages_branch: str
    destination_folder: str
    command_timeout_seconds: float
    network_attempts: int
    retry_base_seconds: float

    @property
    def lock_file(self) -> Path:
        return self.local_repository.parent / (
            "." + self.local_repository.name + ".uploader.lock"
        )

    @property
    def log_file(self) -> Path:
        return self.local_repository.parent / "bitcoin-history-uploader.log"


def configure_logging(log_file: Path) -> None:
    LOGGER.setLevel(logging.INFO)
    LOGGER.handlers.clear()
    formatter = logging.Formatter(
        "%(asctime)s %(levelname)s %(message)s", datefmt="%Y-%m-%d %H:%M:%S"
    )

    console = logging.StreamHandler()
    console.setFormatter(formatter)
    LOGGER.addHandler(console)

    log_file.parent.mkdir(parents=True, exist_ok=True)
    rotating_file = RotatingFileHandler(
        str(log_file), maxBytes=2 * 1024 * 1024, backupCount=2, encoding="utf-8"
    )
    rotating_file.setFormatter(formatter)
    LOGGER.addHandler(rotating_file)


def validate_configuration(
    *,
    source_directory: Path,
    local_repository: Path,
    branch: str,
    pages_branch: str,
) -> None:
    if branch.strip().lower() == pages_branch.strip().lower():
        raise UploadError(
            "The Bitcoin data branch must differ from the GitHub Pages source "
            f"branch ({pages_branch!r}); otherwise every upload redeploys the site."
        )
    if not branch or branch.startswith("-") or ".." in branch:
        raise UploadError(f"Invalid Bitcoin data branch name: {branch!r}")
    if source_directory.resolve() == local_repository.resolve():
        raise UploadError("Source directory and uploader clone must be different paths")


def run_command(
    command: List[str],
    *,
    cwd: Optional[Path] = None,
    check: bool = True,
    timeout_seconds: float = COMMAND_TIMEOUT_SECONDS,
) -> subprocess.CompletedProcess:
    environment = os.environ.copy()
    environment["GIT_TERMINAL_PROMPT"] = "0"
    environment["GCM_INTERACTIVE"] = "Never"
    try:
        result = subprocess.run(
            command,
            cwd=str(cwd) if cwd else None,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
            timeout=timeout_seconds,
            env=environment,
        )
    except FileNotFoundError as exc:
        raise UploadError(
            f"Required command {command[0]!r} was not found. Install Git for "
            "Windows and ensure git.exe is on PATH."
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise UploadError(
            f"Command timed out after {timeout_seconds:g} seconds: "
            + " ".join(command)
        ) from exc

    if check and result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip()
        raise UploadError(
            f"Command failed ({result.returncode}): {' '.join(command)}"
            + (f"\n{detail}" if detail else "")
        )
    return result


def run_git(
    config: UploadConfig, *arguments: str, check: bool = True
) -> subprocess.CompletedProcess:
    return run_command(
        ["git", *arguments],
        cwd=config.local_repository,
        check=check,
        timeout_seconds=config.command_timeout_seconds,
    )


def is_transient_error(error: BaseException) -> bool:
    return bool(TRANSIENT_ERROR_RE.search(str(error)))


def retry_network(
    config: UploadConfig, description: str, operation: Callable[[], object]
) -> object:
    for attempt in range(1, config.network_attempts + 1):
        try:
            return operation()
        except UploadError as exc:
            if attempt >= config.network_attempts or not is_transient_error(exc):
                raise
            delay = config.retry_base_seconds * (2 ** (attempt - 1))
            LOGGER.warning(
                "%s failed transiently (attempt %d/%d); retrying in %.1f seconds: %s",
                description,
                attempt,
                config.network_attempts,
                delay,
                exc,
            )
            time.sleep(delay)
    raise UploadError(f"{description} failed without returning an error")


def normalized_remote(url: str) -> str:
    normalized = url.strip().lower().replace("\\", "/")
    if normalized.endswith(".git"):
        normalized = normalized[:-4]
    return normalized.rstrip("/")


def interval_files(source_directory: Path) -> List[Path]:
    if not source_directory.is_dir():
        raise UploadError(f"Source directory does not exist: {source_directory}")

    files = sorted(
        path
        for path in source_directory.iterdir()
        if path.is_file() and UNLIMITED_INTERVAL_FILE_RE.fullmatch(path.name)
    )
    if not files:
        raise UploadError(
            f"No unlimited interval-history files were found in {source_directory}. "
            "Expected names such as PROPRTS-job_1m-unlimited-history.txt."
        )
    return files


def remote_branch_exists(config: UploadConfig) -> bool:
    def check_branch() -> subprocess.CompletedProcess:
        result = run_command(
            [
                "git",
                "ls-remote",
                "--exit-code",
                "--heads",
                config.repository_url,
                f"refs/heads/{config.branch}",
            ],
            cwd=config.local_repository.parent,
            check=False,
            timeout_seconds=config.command_timeout_seconds,
        )
        if result.returncode not in (0, 2):
            detail = (result.stderr or result.stdout or "").strip()
            raise UploadError(
                f"Could not inspect remote branch {config.branch!r}"
                + (f": {detail}" if detail else "")
            )
        return result

    result = retry_network(config, "Checking the remote data branch", check_branch)
    if result.returncode == 0:
        return bool(result.stdout.strip())
    if result.returncode == 2 and not (result.stderr or "").strip():
        return False
    raise UploadError(f"Could not determine whether branch {config.branch!r} exists")


def configure_snapshot_repository(config: UploadConfig) -> None:
    settings = {
        "gc.auto": "50",
        "gc.autoPackLimit": "5",
        "gc.reflogExpireUnreachable": "now",
        "gc.pruneExpire": "now",
        "fetch.prune": "true",
    }
    for key, value in settings.items():
        run_git(config, "config", key, value)


def ensure_repository(config: UploadConfig) -> None:
    git_marker = config.local_repository / ".git"
    if git_marker.exists():
        actual_remote = run_git(config, "remote", "get-url", "origin").stdout.strip()
        if normalized_remote(actual_remote) != normalized_remote(config.repository_url):
            raise UploadError(
                f"The repository at {config.local_repository} has unexpected origin "
                f"{actual_remote!r}; expected {config.repository_url!r}."
            )
        current_branch = run_git(
            config, "symbolic-ref", "--short", "HEAD"
        ).stdout.strip()
        if current_branch != config.branch:
            raise UploadError(
                f"Uploader clone is on {current_branch!r}; expected {config.branch!r}."
            )
        configure_snapshot_repository(config)
        return

    if config.local_repository.exists() and any(config.local_repository.iterdir()):
        raise UploadError(
            f"{config.local_repository} exists but is not an empty Git repository."
        )

    config.local_repository.parent.mkdir(parents=True, exist_ok=True)
    if remote_branch_exists(config):
        LOGGER.info(
            "Cloning compact snapshot branch %s into %s",
            config.branch,
            config.local_repository,
        )

        def clone() -> subprocess.CompletedProcess:
            return run_command(
                [
                    "git",
                    "clone",
                    "--branch",
                    config.branch,
                    "--single-branch",
                    "--depth",
                    "1",
                    config.repository_url,
                    str(config.local_repository),
                ],
                cwd=config.local_repository.parent,
                timeout_seconds=config.command_timeout_seconds,
            )

        retry_network(config, "Cloning the data branch", clone)
    else:
        LOGGER.info("Creating new orphan snapshot branch %s", config.branch)
        config.local_repository.mkdir(parents=True, exist_ok=True)
        run_git(config, "init")
        run_git(config, "remote", "add", "origin", config.repository_url)
        run_git(config, "checkout", "--orphan", config.branch)

    configure_snapshot_repository(config)


def repository_changes(config: UploadConfig) -> Set[str]:
    commands = (
        ("diff", "--name-only"),
        ("diff", "--cached", "--name-only"),
        ("ls-files", "--others", "--exclude-standard"),
    )
    paths: Set[str] = set()
    for command in commands:
        output = run_git(config, *command).stdout
        paths.update(line.strip().replace("\\", "/") for line in output.splitlines())
    return {path for path in paths if path}


def assert_no_unrelated_local_changes(config: UploadConfig) -> None:
    destination = PurePosixPath(config.destination_folder)
    unrelated = sorted(
        path
        for path in repository_changes(config)
        if PurePosixPath(path) != destination
        and destination not in PurePosixPath(path).parents
    )
    if unrelated:
        raise UploadError(
            "Uploader clone has unrelated local changes; nothing was staged:\n  "
            + "\n  ".join(unrelated)
        )


def copy_stable_snapshot(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    last_error: Optional[BaseException] = None
    for attempt in range(1, 4):
        temporary_name: Optional[str] = None
        try:
            before = source.stat()
            with source.open("rb") as source_handle, tempfile.NamedTemporaryFile(
                mode="wb",
                dir=str(destination.parent),
                prefix=".bitcoin-upload-",
                delete=False,
            ) as temporary_handle:
                temporary_name = temporary_handle.name
                shutil.copyfileobj(source_handle, temporary_handle)

            after = source.stat()
            if before.st_size != after.st_size or before.st_mtime_ns != after.st_mtime_ns:
                raise UploadError(f"{source.name} changed while it was copied")

            os.replace(temporary_name, str(destination))
            temporary_name = None
            shutil.copystat(str(source), str(destination))
            return
        except (OSError, UploadError) as exc:
            last_error = exc
            if attempt < 3:
                time.sleep(0.25)
        finally:
            if temporary_name:
                try:
                    Path(temporary_name).unlink()
                except OSError:
                    pass
    raise UploadError(
        f"Could not copy stable snapshot {source} after three attempts: {last_error}"
    )


def has_head(config: UploadConfig) -> bool:
    return run_git(config, "rev-parse", "--verify", "HEAD", check=False).returncode == 0


def git_directory(config: UploadConfig) -> Path:
    value = run_git(config, "rev-parse", "--git-dir").stdout.strip()
    path = Path(value)
    return path if path.is_absolute() else config.local_repository / path


def pending_lease_file(config: UploadConfig) -> Path:
    return git_directory(config) / "bitcoin-uploader-pending-lease"


def push_snapshot(config: UploadConfig, expected_remote: Optional[str]) -> None:
    expected = expected_remote or ""
    lease = f"--force-with-lease=refs/heads/{config.branch}:{expected}"

    def push() -> subprocess.CompletedProcess:
        return run_git(
            config,
            "push",
            lease,
            "--set-upstream",
            "origin",
            f"HEAD:{config.branch}",
        )

    retry_network(config, "Pushing the Bitcoin snapshot", push)


def recover_pending_push(config: UploadConfig) -> bool:
    lease_file = pending_lease_file(config)
    if not lease_file.exists():
        return False
    value = lease_file.read_text(encoding="ascii").strip()
    expected_remote = None if value == "CREATE" else value
    if expected_remote is not None and not COMMIT_SHA_RE.fullmatch(expected_remote):
        raise UploadError(f"Invalid pending-push lease state in {lease_file}")
    LOGGER.warning("Retrying a previously committed snapshot that was not pushed")
    push_snapshot(config, expected_remote)
    lease_file.unlink()
    return True


def upload_once(config: UploadConfig) -> bool:
    sources = interval_files(config.source_directory)
    ensure_repository(config)
    recover_pending_push(config)
    assert_no_unrelated_local_changes(config)

    destination = config.local_repository / config.destination_folder
    copied_paths: List[str] = []
    for source in sources:
        target = destination / source.name
        copy_stable_snapshot(source, target)
        copied_paths.append(
            (PurePosixPath(config.destination_folder) / source.name).as_posix()
        )

    run_git(config, "add", "--", *copied_paths)
    diff = run_git(
        config, "diff", "--cached", "--quiet", "--", *copied_paths, check=False
    )
    if diff.returncode == 0:
        LOGGER.info("No history changes to upload (%d files checked)", len(sources))
        return False
    if diff.returncode != 1:
        raise UploadError("Git could not determine whether snapshot files changed")

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    expected_remote: Optional[str] = None
    if has_head(config):
        expected_remote = run_git(config, "rev-parse", "HEAD").stdout.strip()
        run_git(
            config,
            "commit",
            "--amend",
            "-m",
            f"Update Bitcoin data snapshot ({timestamp})",
        )
    else:
        run_git(config, "commit", "-m", f"Create Bitcoin data snapshot ({timestamp})")

    lease_file = pending_lease_file(config)
    lease_file.write_text(expected_remote or "CREATE", encoding="ascii")
    LOGGER.info(
        "Publishing %d files to dedicated branch %s", len(sources), config.branch
    )
    push_snapshot(config, expected_remote)
    lease_file.unlink()
    LOGGER.info("Bitcoin snapshot upload completed successfully")
    return True


def compact_repository(config: UploadConfig) -> None:
    LOGGER.info("Compacting the dedicated uploader clone")
    run_git(config, "reflog", "expire", "--expire=now", "--expire-unreachable=now", "--all")
    run_git(config, "gc", "--prune=now", "--quiet")


def process_exists(process_id: int) -> bool:
    if process_id <= 0:
        return False
    try:
        os.kill(process_id, 0)
    except OSError:
        return False
    return True


@contextmanager
def uploader_lock(path: Path) -> Iterator[None]:
    path.parent.mkdir(parents=True, exist_ok=True)
    for _ in range(2):
        try:
            descriptor = os.open(str(path), os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            with os.fdopen(descriptor, "w", encoding="ascii") as lock_handle:
                lock_handle.write(str(os.getpid()))
            break
        except FileExistsError:
            try:
                existing_pid = int(path.read_text(encoding="ascii").strip())
            except (OSError, ValueError):
                existing_pid = -1
            if process_exists(existing_pid):
                raise UploadError(
                    f"Another uploader process is already running with PID {existing_pid}."
                )
            try:
                path.unlink()
            except OSError as exc:
                raise UploadError(f"Could not remove stale uploader lock {path}: {exc}")
    else:
        raise UploadError(f"Could not acquire uploader lock {path}")

    try:
        yield
    finally:
        try:
            path.unlink()
        except OSError:
            LOGGER.warning("Could not remove uploader lock %s", path)


def positive_number(value: str) -> float:
    try:
        number = float(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("value must be a number") from exc
    if number <= 0:
        raise argparse.ArgumentTypeError("value must be greater than zero")
    return number


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--once", action="store_true", help="upload one snapshot and exit")
    mode.add_argument(
        "--dry-run",
        action="store_true",
        help="validate paths and list source files without changing GitHub",
    )
    parser.add_argument(
        "--interval-minutes",
        type=positive_number,
        default=UPLOAD_INTERVAL_MINUTES,
        help=f"continuous upload interval (default: {UPLOAD_INTERVAL_MINUTES:g})",
    )
    parser.add_argument("--source-directory", type=Path, default=SOURCE_DIRECTORY)
    parser.add_argument("--local-repository", type=Path, default=LOCAL_REPOSITORY)
    parser.add_argument("--branch", default=BRANCH)
    parser.add_argument(
        "--command-timeout-seconds",
        type=positive_number,
        default=COMMAND_TIMEOUT_SECONDS,
    )
    return parser.parse_args()


def build_config(arguments: argparse.Namespace) -> UploadConfig:
    config = UploadConfig(
        source_directory=arguments.source_directory,
        local_repository=arguments.local_repository,
        repository_url=REPOSITORY_URL,
        branch=arguments.branch,
        pages_branch=PAGES_BRANCH,
        destination_folder=DESTINATION_FOLDER,
        command_timeout_seconds=arguments.command_timeout_seconds,
        network_attempts=NETWORK_ATTEMPTS,
        retry_base_seconds=RETRY_BASE_SECONDS,
    )
    validate_configuration(
        source_directory=config.source_directory,
        local_repository=config.local_repository,
        branch=config.branch,
        pages_branch=config.pages_branch,
    )
    return config


def dry_run(config: UploadConfig) -> None:
    run_command(["git", "--version"], timeout_seconds=config.command_timeout_seconds)
    sources = interval_files(config.source_directory)
    LOGGER.info("Dry run found %d history files", len(sources))
    for source in sources:
        LOGGER.info("  %s (%d bytes)", source.name, source.stat().st_size)
    LOGGER.info(
        "Snapshots will publish to %s branch %s, not Pages branch %s",
        config.repository_url,
        config.branch,
        config.pages_branch,
    )


def run_continuously(config: UploadConfig, interval_minutes: float) -> None:
    successful_uploads = 0
    LOGGER.info(
        "Uploader started; publishing to %s every %g minutes. Press Ctrl+C to stop.",
        config.branch,
        interval_minutes,
    )
    while True:
        started = time.monotonic()
        try:
            if upload_once(config):
                successful_uploads += 1
                if successful_uploads % MAINTENANCE_EVERY_UPLOADS == 0:
                    compact_repository(config)
        except UploadError:
            LOGGER.exception("Upload failed; retrying on the next interval")
        elapsed = time.monotonic() - started
        time.sleep(max(1.0, interval_minutes * 60.0 - elapsed))


def main() -> int:
    arguments = parse_arguments()
    try:
        config = build_config(arguments)
        configure_logging(config.log_file)
        if arguments.dry_run:
            dry_run(config)
            return 0

        with uploader_lock(config.lock_file):
            if arguments.once:
                if upload_once(config):
                    compact_repository(config)
                return 0
            run_continuously(config, arguments.interval_minutes)
    except KeyboardInterrupt:
        LOGGER.info("Uploader stopped")
        return 0
    except UploadError:
        LOGGER.exception("Uploader stopped because of a configuration or upload error")
        return 1


if __name__ == "__main__":
    sys.exit(main())
