import importlib.util
from pathlib import Path
import sys
import tempfile
import unittest


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "upload_bitcoin_history.py"


def load_uploader():
    spec = importlib.util.spec_from_file_location("upload_bitcoin_history", SCRIPT_PATH)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


class UploadBitcoinHistoryTests(unittest.TestCase):
    def test_normalized_remote_ignores_git_suffix_and_case(self):
        uploader = load_uploader()
        self.assertEqual(
            uploader.normalized_remote("HTTPS://GITHUB.COM/0x00C0DE/repo.git"),
            "https://github.com/0x00c0de/repo",
        )

    def test_transient_network_failures_are_retryable_but_auth_failures_are_not(self):
        uploader = load_uploader()
        self.assertTrue(uploader.is_transient_error(uploader.UploadError("HTTP 503")))
        self.assertTrue(
            uploader.is_transient_error(
                uploader.UploadError("fatal: the remote end hung up unexpectedly")
            )
        )
        self.assertFalse(
            uploader.is_transient_error(
                uploader.UploadError("Authentication failed for repository")
            )
        )

    def test_interval_files_only_selects_supported_unlimited_history_names(self):
        uploader = load_uploader()
        with tempfile.TemporaryDirectory() as temporary_directory:
            source = Path(temporary_directory)
            expected = source / "PROPRTS-job_1m-unlimited-history.txt"
            expected.write_text("{}\n", encoding="utf-8")
            (source / "PROPRTS-job_1m-history.txt").write_text("ignored\n", encoding="utf-8")
            (source / "notes.txt").write_text("ignored\n", encoding="utf-8")

            self.assertEqual(uploader.interval_files(source), [expected])

    def test_configuration_refuses_to_publish_snapshots_to_pages_branch(self):
        uploader = load_uploader()
        with self.assertRaisesRegex(uploader.UploadError, "must differ"):
            uploader.validate_configuration(
                source_directory=Path("source"),
                local_repository=Path("clone"),
                branch="main",
                pages_branch="main",
            )


if __name__ == "__main__":
    unittest.main()
