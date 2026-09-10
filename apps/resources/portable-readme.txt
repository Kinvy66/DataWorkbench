DataWorkbench portable build
============================

This folder is a portable Windows x64 build (not an NSIS installer).

Python is not embedded. Install Python 3.11 or 3.12 on the machine, then:

  py -3.12 -m pip install -r resources\python\requirements.txt

Or set DW_PYTHON to a python.exe that already has those packages.
Optional: DW_PYTHON_ROOT to the resources\python folder if you move the scripts.

Run DataWorkbench.exe in this folder. Do not copy testdata or .env into a release zip.

LGPL notices for vendored Python/icons: resources\NOTICE.txt
