import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(__dirname, '../BACKEND');
const baseUrl = 'http://localhost:3000/auth';

const headers = {
  'Content-Type': 'application/json',
  Accept: 'application/json'
};

const post = async (path, payload) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });
  let body = null;
  try {
    body = await response.json();
  } catch (error) {
    body = { parseError: error.message };
  }
  return { status: response.status, ok: response.ok, body };
};

const logResult = (label, result, expectation) => {
  console.log(`\n=== ${label} ===`);
  console.log('Request:', expectation.requestDescription);
  console.log('Expected:', expectation.expectedOutcome);
  console.log('Received:', JSON.stringify(result, null, 2));
};

const startBackend = async () => {
  console.log(`Iniciando backend em ${backendDir}`);
  const child = spawn('node', ['SRC/JS/index.js'], {
    cwd: backendDir,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const stdoutLogs = [];
  const stderrLogs = [];

  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    stdoutLogs.push(text);
    process.stdout.write(`[backend] ${text}`);
  });

  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    stderrLogs.push(text);
    process.stderr.write(`[backend:err] ${text}`);
  });

  const readyRegex = /Server running at/;

  const readyPromise = new Promise((resolve, reject) => {
    const handleReady = (chunk) => {
      if (readyRegex.test(chunk.toString())) {
        child.stdout.off('data', handleReady);
        resolve();
      }
    };

    child.stdout.on('data', handleReady);

    child.once('error', (error) => {
      child.stdout.off('data', handleReady);
      reject(error);
    });

    child.once('exit', (code) => {
      child.stdout.off('data', handleReady);
      reject(new Error(`Backend finalizou antes do pronto (exit code ${code}). Logs: ${stdoutLogs.join('')} ${stderrLogs.join('')}`));
    });

    setTimeout(() => {
      child.stdout.off('data', handleReady);
      reject(new Error('Timeout aguardando backend iniciar.'));
    }, 10000);
  });

  await readyPromise;
  return child;
};

const stopBackend = async (child) => {
  if (!child || child.killed) {
    return;
  }
  child.kill('SIGINT');
  try {
    await Promise.race([
      once(child, 'exit'),
      new Promise((resolve) => setTimeout(resolve, 5000))
    ]);
  } catch (error) {
    console.warn('Falha ao aguardar backend encerrar:', error);
  }
};

const run = async () => {
  const startedAt = new Date();
  console.log(`Auth diagnostics started at ${startedAt.toISOString()}`);

  let backendProcess;
  try {
    backendProcess = await startBackend();
  } catch (error) {
    console.error('Não foi possível iniciar o backend para testes:', error);
    process.exitCode = 1;
    return;
  }

  try {
    const suffix = Date.now();
    const validUser = {
      username: `test_${suffix}`,
      email: `test_${suffix}@example.com`,
      password: 'P@ssword1234'
    };

    const tests = [];

    // Test 1: successful signup
    tests.push({
      label: 'Signup success',
      exec: () => post('/signup', validUser),
      expectation: {
        requestDescription: 'POST /auth/signup with valid new user data',
        expectedOutcome: 'Should return 201 with success true and token'
      },
      verify: (result) => {
        assert.equal(result.status, 201, 'Status must be 201 Created');
        assert.equal(result.body?.success, true, 'Response success should be true');
        assert.ok(result.body?.token, 'Token must be present');
        assert.ok(result.body?.user?.id, 'User id should be returned');
      }
    });

    // Test 2: duplicate signup should fail
    tests.push({
      label: 'Signup duplicate',
      exec: () => post('/signup', validUser),
      expectation: {
        requestDescription: 'POST /auth/signup with duplicate user data',
        expectedOutcome: 'Should return 409 conflict about duplicate user/email'
      },
      verify: (result) => {
        assert.equal(result.status, 409, 'Status must be 409 Conflict');
        assert.equal(result.body?.success, false, 'Response success should be false');
      }
    });

    // Test 3: invalid password length
    tests.push({
      label: 'Signup weak password',
      exec: () => post('/signup', {
        username: `weak_${suffix}`,
        email: `weak_${suffix}@example.com`,
        password: '123'
      }),
      expectation: {
        requestDescription: 'POST /auth/signup with short password',
        expectedOutcome: 'Should return 400 with password length validation message'
      },
      verify: (result) => {
        assert.equal(result.status, 400, 'Status must be 400 Bad Request');
        assert.equal(result.body?.success, false, 'Response success should be false');
      }
    });

    // Test 4: login wrong password
    tests.push({
      label: 'Login wrong password',
      exec: () => post('/login', {
        email: validUser.email,
        password: 'WrongPassword123'
      }),
      expectation: {
        requestDescription: 'POST /auth/login with wrong password',
        expectedOutcome: 'Should return 401 invalid credentials'
      },
      verify: (result) => {
        assert.equal(result.status, 401, 'Status must be 401 Unauthorized');
        assert.equal(result.body?.success, false, 'Response success should be false');
      }
    });

    // Test 5: login success
    tests.push({
      label: 'Login success',
      exec: () => post('/login', {
        email: validUser.email,
        password: validUser.password
      }),
      expectation: {
        requestDescription: 'POST /auth/login with valid credentials',
        expectedOutcome: 'Should return 200 success true and token'
      },
      verify: (result) => {
        assert.equal(result.status, 200, 'Status must be 200 OK');
        assert.equal(result.body?.success, true, 'Response success should be true');
        assert.ok(result.body?.token, 'Token must be present');
      }
    });

    const summary = [];

    for (const test of tests) {
      try {
        const result = await test.exec();
        logResult(test.label, result, test.expectation);
        test.verify(result);
        summary.push({ label: test.label, status: 'passed' });
      } catch (error) {
        summary.push({ label: test.label, status: 'failed', error: error.message });
        console.error(`Test ${test.label} failed:`, error);
      }
    }

    const finishedAt = new Date();
    console.log(`\nAuth diagnostics finished at ${finishedAt.toISOString()}`);
    console.table(summary);

    const hasFailures = summary.some((item) => item.status === 'failed');
    if (hasFailures) {
      process.exitCode = 1;
    }
  } finally {
    await stopBackend(backendProcess);
  }
};

run().catch((error) => {
  console.error('Unexpected error during auth diagnostics:', error);
  process.exitCode = 1;
});
