#!/usr/bin/env python3
"""Materialize exact tracked Git blobs for secret scanning, never checkout filters.

Symlink blobs are written as regular text files, never followed. Submodules
and unsupported entries block the scan. No filenames or blob values are logged.
"""
import os
import re
import subprocess
import sys
from pathlib import Path


def git(root, *args):
    return subprocess.check_output(["git", *args], cwd=root, stderr=subprocess.DEVNULL)


def materialize(root, commit, destination):
    if not re.fullmatch(r"[a-f0-9]{40}", commit):
        raise ValueError("INVALID_COMMIT")
    if git(root, "rev-parse", "--verify", commit + "^{commit}").strip() != commit.encode():
        raise ValueError("COMMIT_MISMATCH")
    destination = Path(destination)
    if destination.is_symlink() or not destination.is_dir() or any(destination.iterdir()):
        raise ValueError("DESTINATION_NOT_EMPTY")
    raw = git(root, "ls-tree", "-r", "-z", "--full-tree", commit)
    entries = []
    seen = set()
    for record in raw.split(b"\0"):
        if not record:
            continue
        header, name = record.split(b"\t", 1)
        mode, kind, oid = header.split(b" ")
        parts = name.split(b"/")
        if (kind != b"blob" or mode not in (b"100644", b"100755", b"120000")
                or not re.fullmatch(rb"[a-f0-9]{40}", oid)):
            raise ValueError("UNSUPPORTED_TRACKED_ENTRY")
        if any(part in (b"", b".", b"..", b".git") for part in parts) or name in seen:
            raise ValueError("UNSAFE_OR_DUPLICATE_TRACKED_PATH")
        seen.add(name)
        entries.append((parts, oid))
    if not entries:
        raise ValueError("EMPTY_TRACKED_TREE")
    for parts, oid in entries:
        target = destination.joinpath(*(os.fsdecode(part) for part in parts))
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open("xb") as output:
            subprocess.run(["git", "cat-file", "blob", oid.decode("ascii")],
                           cwd=root, stdout=output, stderr=subprocess.DEVNULL, check=True)
    return len(entries)


if __name__ == "__main__":
    try:
        if len(sys.argv) != 3:
            raise ValueError("USAGE")
        count = materialize(".", sys.argv[1], sys.argv[2])
        print("TRACKED_BLOBS_MATERIALIZED=" + str(count))
    except Exception:
        print("TRACKED_SNAPSHOT_MATERIALIZATION=ERROR_NOT_QUALIFIED", file=sys.stderr)
        sys.exit(2)
