from setuptools import find_packages, setup


setup(
    name="neighborhood-investment-intelligence",
    version="0.1.0",
    package_dir={"": "src"},
    packages=find_packages("src"),
    install_requires=[
        "duckdb==1.1.3",
        "httpx==0.28.1",
        "pydantic==2.10.4",
        "pydantic-settings==2.7.0",
        "PyYAML==6.0.2",
        "tenacity==9.0.0",
        "typer==0.15.1",
    ],
    entry_points={"console_scripts": ["nii=neighborhood_intelligence.cli:app"]},
)
