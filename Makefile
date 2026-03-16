# Makefile for nex-code project

.PHONY: all build test clean

# Default target
all: clean build test

# Build target - compiles TypeScript
build: dist
	dist:
	npx tsc

# Test target - runs Jest tests
test:
	npx jest --coverage

# Clean target - removes dist directory
clean:
	rm -rf dist

# Dependency chain
# all depends on clean, build, and test
# build depends on dist directory being created
# clean removes dist directory
