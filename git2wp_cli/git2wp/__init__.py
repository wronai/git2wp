"""Git2WP - CLI tool for publishing Git repository changes to WordPress."""

__version__ = "0.1.0"


def main():
    """Entry point for the application script."""
    from .__main__ import main as _main

    return _main()
