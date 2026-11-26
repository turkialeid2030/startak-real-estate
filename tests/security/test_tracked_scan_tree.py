#!/usr/bin/env python3
"""Synthetic real Git repository tests for exact tracked snapshot coverage."""
import importlib.util
import os
import subprocess
import tempfile
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "tracked_scan_tree", Path(__file__).resolve().parents[2] / "tools/security/materialize-tracked-scan-tree.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def git(root, *args):
    return subprocess.check_output(["git", *args], cwd=root, stderr=subprocess.DEVNULL)

with tempfile.TemporaryDirectory() as tmp:
    root = Path(tmp) / "repo"
    root.mkdir()
    git(root, "init", "-q")
    git(root, "config", "user.email", "synthetic@example.invalid")
    git(root, "config", "user.name", "Synthetic test")
    (root / ".gitattributes").write_text("ignored.txt export-ignore\nsubst.txt export-subst\n")
    (root / "ignored.txt").write_bytes(b"synthetic ignored fixture\n")
    (root / "subst.txt").write_bytes(b"$Format:%H$\n")
    (root / "binary.dat").write_bytes(b"\x00\xff\x01")
    (root / "name\nwith space.txt").write_bytes(b"tracked unusual filename")
    os.symlink("/not/a/real/file", root / "link")
    git(root, "add", ".")
    git(root, "commit", "-qm", "synthetic fixture")
    commit = git(root, "rev-parse", "HEAD").decode().strip()
    (root / "ignored.txt").write_bytes(b"uncommitted change")
    dest = Path(tmp) / "snapshot"
    dest.mkdir()
    assert module.materialize(root, commit, dest) == 6
    assert (dest / "ignored.txt").read_bytes() == b"synthetic ignored fixture\n"
    assert (dest / "subst.txt").read_bytes() == b"$Format:%H$\n"
    assert (dest / "binary.dat").read_bytes() == b"\x00\xff\x01"
    assert (dest / "name\nwith space.txt").read_bytes() == b"tracked unusual filename"
    assert not (dest / "link").is_symlink()
    assert (dest / "link").read_bytes() == b"/not/a/real/file"
    assert (dest / ".gitattributes").exists()
    try:
        module.materialize(root, commit, dest)
        raise AssertionError("nonempty destination accepted")
    except ValueError as exc:
        assert str(exc) == "DESTINATION_NOT_EMPTY"
    empty = Path(tmp) / "empty"
    empty.mkdir()
    try:
        module.materialize(root, "not-a-commit", empty)
        raise AssertionError("invalid revision accepted")
    except ValueError as exc:
        assert str(exc) == "INVALID_COMMIT"
    git(root, "update-index", "--add", "--cacheinfo", "160000," + commit + ",submodule")
    git(root, "commit", "-qm", "synthetic gitlink")
    new_commit = git(root, "rev-parse", "HEAD").decode().strip()
    try:
        module.materialize(root, new_commit, empty)
        raise AssertionError("unscanned gitlink accepted")
    except ValueError as exc:
        assert str(exc) == "UNSUPPORTED_TRACKED_ENTRY"
    assert not any(empty.iterdir())
print("TRACKED_SNAPSHOT_MATERIALIZATION_TESTS=PASS checks=12")
