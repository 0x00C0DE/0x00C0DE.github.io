import sys
import xml.etree.ElementTree as ET

feature, path = sys.argv[1:]
root = ET.parse(path).getroot()
if feature == "blog-feed":
    atom = "{http://www.w3.org/2005/Atom}"
    valid = root.tag == atom + "feed" and root.find(atom + "entry") is not None
elif feature == "sitemap":
    ns = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
    locations = {node.text for node in root.findall(f"{ns}url/{ns}loc")}
    valid = root.tag == ns + "urlset" and {
        "https://0x00c0de.github.io/",
        "https://0x00c0de.github.io/pages/projects.html",
    }.issubset(locations)
else:
    valid = False

if not valid:
    sys.exit(f"Invalid artifact for {feature}")
