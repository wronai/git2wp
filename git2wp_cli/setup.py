from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="git2wp-cli",
    version="0.1.0",
    author="Your Name",
    author_email="your.email@example.com",
    description="A command-line tool for publishing Git repository changes to WordPress",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/yourusername/git2wp",
    packages=find_packages(where="."),
    package_dir={"": "."},
    py_modules=["cli"],
    package_data={
        "git2wp_cli": ["*.json"],
    },
    install_requires=[
        "click>=8.0.0",
        "python-dotenv>=0.19.0",
        "requests>=2.26.0",
        "rich>=10.0.0",
    ],
    entry_points={
        "console_scripts": [
            "git2wp=cli:main",
        ],
    },
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "Topic :: Software Development :: Version Control :: Git",
        "Topic :: Internet :: WWW/HTTP :: Site Management",
    ],
    python_requires='>=3.7',
)
