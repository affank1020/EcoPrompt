"""Execute the notebook locally and preserve outputs, including on failure."""
from pathlib import Path
import os
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent
os.chdir(ROOT)
os.environ.setdefault("HF_HOME", str(ROOT / "data" / "hf_home"))
os.environ.setdefault("MPLCONFIGDIR", str(ROOT / ".runtime" / "matplotlib"))
os.environ.setdefault("IPYTHONDIR", str(ROOT / ".runtime" / "ipython"))
os.environ.setdefault("JUPYTER_DATA_DIR", str(ROOT / ".runtime" / "jupyter"))
os.environ.setdefault("JUPYTER_RUNTIME_DIR", str(ROOT / ".runtime" / "jupyter_runtime"))

import nbformat
from nbclient import NotebookClient
from jupyter_client.kernelspec import KernelSpecManager

# Keep this kernel registration inside the project, not in the user's profile.
import json
kernel_dir = ROOT / ".runtime" / "kernel"
kernel_dir.mkdir(parents=True, exist_ok=True)
(kernel_dir / "kernel.json").write_text(json.dumps({
    "argv": [sys.executable, "-m", "ipykernel_launcher", "-f", "{connection_file}"],
    "display_name": "Prompt complexity (local)", "language": "python",
}), encoding="utf-8")
KernelSpecManager().install_kernel_spec(str(kernel_dir), kernel_name="prompt-complexity", user=True)

notebook_path = ROOT / "main.ipynb"
notebook = nbformat.read(notebook_path, as_version=4)
nbformat.validate(notebook)
# Dependencies have already been installed by the command-line setup.
notebook.cells[1].metadata["tags"] = ["skip-execution"]
class ProgressClient(NotebookClient):
    def process_message(self, msg, cell, cell_index):
        if msg.get("msg_type") == "stream":
            text = msg.get("content", {}).get("text", "")
            print(text, end="", flush=True)
        return super().process_message(msg, cell, cell_index)


client = ProgressClient(notebook, timeout=None, kernel_name="prompt-complexity",
                        resources={"metadata": {"path": str(ROOT)}})

def report_cell(cell, cell_index, **kwargs):
    print(f"Executing notebook cell {cell_index + 1}/{len(notebook.cells)}", flush=True)

client.on_cell_start = report_cell
try:
    client.execute()
finally:
    notebook.cells[1].metadata.pop("tags", None)
    nbformat.write(notebook, notebook_path)
print("Notebook execution complete.", flush=True)
