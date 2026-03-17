# Makefile for nex-code project

.PHONY: all build test clean

# Default target
all: clean build test

# Build target - compiles TypeScript
build:
	npx tsc

# Test target - runs Jest tests
test:
	jest --coverage

# Clean target - removes dist directory
clean:
	rm -rf dist

# Dependency chain
# all depends on clean, build, and test
