# Makefile for nex-code project

.PHONY: all build test clean

# Default target
all: clean build test

# Build target - uses esbuild directly as defined in package.json
build:
	npm run build

# Test target - runs Jest tests
test:
	npx jest --coverage

# Clean target - removes dist directory
clean:
	rm -rf dist
