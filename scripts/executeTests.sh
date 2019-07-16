#!/usr/bin/env bash

echo "Starting ganache-cli"
npx ganache-cli -p 7545 -e 1000000 -l 8000000 > /dev/null 2> /dev/null &
GANACHE_PID=$! # get process id

while ! echo exit | nc localhost 7545; do sleep 1; done > /dev/null 2> /dev/null
echo "ganache-cli started successfully"

echo "Starting truffle tests"
npx truffle test

echo "Stopping ganache-cli"
kill $GANACHE_PID
