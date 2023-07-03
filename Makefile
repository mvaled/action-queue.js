PATH := ./node_modules/.bin/:$(PATH)

node_modules yarn.lock: package.json
	@yarn install
	@touch node_modules

run: yarn.lock node_modules
	@vite

build: yarn.lock node_modules src/index.js
	@vite build
	@cp -f out/* dist/
	@vite build --mode development
	@cp -f out/* dist/
	@rm -rf out

test:
	@yarn run test
.PHONY: test

coverage: 
	@yarn run coverage
.PHONY: coverage

