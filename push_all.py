#!/usr/bin/env python3
"""Stage all changes, commit them, and push the current branch."""

import argparse
from datetime import datetime
from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parent
SENSITIVE_NAMES = {"id_rsa", "id_ed25519", "credentials.json", "secrets.json"}
SENSITIVE_SUFFIXES = {".pem", ".key", ".p12", ".pfx", ".keystore"}
SAFE_ENV_SUFFIXES = {".example", ".sample", ".template"}


def git(*args, check=True):
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    if check and result.returncode:
        if result.stdout:
            print(result.stdout, end="")
        if result.stderr:
            print(result.stderr, end="", file=sys.stderr)
        raise SystemExit(result.returncode)
    return result


def push_target(branch):
    remotes = git("remote").stdout.splitlines()
    upstream = git(
        "rev-parse", "--symbolic-full-name", "@{upstream}", check=False
    )

    if upstream.returncode == 0:
        ref = upstream.stdout.strip()
        for remote in sorted(remotes, key=len, reverse=True):
            prefix = f"refs/remotes/{remote}/"
            if ref.startswith(prefix):
                return remote, ref[len(prefix):], False
        raise SystemExit(f"Cannot determine the remote for upstream {ref!r}.")

    if "origin" in remotes:
        return "origin", branch, True
    if len(remotes) == 1:
        return remotes[0], branch, True
    if not remotes:
        raise SystemExit("No Git remote is configured.")
    raise SystemExit("No upstream is configured; cannot choose a remote.")


def is_sensitive(path):
    name = Path(path).name.lower()
    suffix = Path(name).suffix
    if name in SENSITIVE_NAMES or suffix in SENSITIVE_SUFFIXES:
        return True
    return name.startswith(".env") and not name.endswith(
        tuple(SAFE_ENV_SUFFIXES)
    )


def main():
    if git("rev-parse", "--show-toplevel", check=False).returncode:
        raise SystemExit("Run this script from inside a Git repository.")

    parser = argparse.ArgumentParser(
        description="Commit all non-ignored changes and push the current branch."
    )
    parser.add_argument(
        "-m",
        "--message",
        help="commit message (default: timestamped Auto publish message)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="show the changes and push target without staging or pushing",
    )
    args = parser.parse_args()

    branch = git("symbolic-ref", "--quiet", "--short", "HEAD", check=False)
    if branch.returncode:
        raise SystemExit("Cannot push from a detached HEAD.")
    branch = branch.stdout.strip()
    remote, remote_branch, set_upstream = push_target(branch)

    status = git("status", "--short", "--untracked-files=all").stdout
    message = args.message or (
        "Auto publish " + datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S %z")
    )

    if args.dry_run:
        print(status or "Working tree is clean.")
        print(f"Would commit as: {message}")
        print(f"Would push {branch} to {remote}/{remote_branch}.")
        return

    git("add", "-A")
    staged = git("diff", "--cached", "--name-only", "-z").stdout.split("\0")
    staged = [path for path in staged if path]
    blocked = [path for path in staged if is_sensitive(path)]
    if blocked:
        print("Refusing to push sensitive-looking paths:", file=sys.stderr)
        for path in blocked:
            print(f"  {path}", file=sys.stderr)
        raise SystemExit("Unstage or ignore those paths, then run the script again.")

    if staged:
        git("commit", "-m", message)
    else:
        print("No file changes to commit; pushing any existing local commits.")

    push_args = ["push"]
    if set_upstream:
        push_args.append("-u")
    push_args.extend([remote, f"HEAD:refs/heads/{remote_branch}"])
    git(*push_args)


if __name__ == "__main__":
    main()
