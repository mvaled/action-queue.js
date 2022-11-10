PATH := ./node_modules/.bin/:$(PATH)
yarn.lock: package.json
	@yarn install

test: yarn.lock
	@yarn run test

caddy: yarn.lock
	@caddy file-server --browse --listen ':9999' --root .

.PHONY: test
