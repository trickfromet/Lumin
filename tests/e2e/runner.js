const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

// Register TS loader for Node compatibility offline
require.extensions['.ts'] = function (module, filename) {
  let content = fs.readFileSync(filename, 'utf8');
  
  // Clean TypeScript constructs
  content = content.replace(/['"]use client['"];?/g, '');
  content = content.replace(/export\s+const\s+(\w+)\s*=/g, 'const $1 = exports.$1 =');
  content = content.replace(/export\s+class\s+(\w+)/g, 'class $1');
  content = content.replace(/export\s+default\s+(\w+)/g, 'module.exports = $1');
  
  // Remove class access modifiers (private, public, protected, readonly)
  content = content.replace(/\b(private|public|protected|readonly)\s+/g, '');
  
  // Replace type annotations in properties, variables, and parameters
  content = content.replace(/:\s*[a-zA-Z_][\w\d_<>\[\]|]*(\s*\|\s*null|\s*\|\s*undefined)?(?=\s*(=|,|\)|;|\{))/g, '');
  
  // Remove type assertions like 'as type'
  content = content.replace(/as\s+unknown\s+as\s+\{[^}]*\}/g, '');
  content = content.replace(/as\s+[\w\d_<>\[\]|{}()\s:]+/g, '');
  
  // Clean non-null assertions: masterGain! -> masterGain
  content = content.replace(/!(\.|\)|,)/g, '$1');
  
  module._compile(content, filename);
};

// 1. Clean up port 3000 on Windows
function killPort3000() {
  try {
    console.log('Cleaning up port 3000...');
    const output = execSync('netstat -ano').toString();
    const lines = output.split('\n');
    const pidsToKill = new Set();
    for (const line of lines) {
      if (line.includes(':3000') && line.includes('LISTENING')) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && !isNaN(pid) && pid !== '0') {
          pidsToKill.add(pid);
        }
      }
    }
    for (const pid of pidsToKill) {
      console.log(`Killing process ${pid} on port 3000...`);
      try {
        execSync(`taskkill /F /PID ${pid}`);
      } catch (e) {
        // ignore error
      }
    }
  } catch (err) {
    // ignore
  }
}

// 2. HTTP Client TestAgent with cookie persistence
class TestAgent {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.cookies = {};
  }

  getCookieString() {
    return Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  updateCookies(cookieHeader) {
    if (!cookieHeader) return;
    const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
    for (const cookie of cookies) {
      const parts = cookie.split(';')[0].split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim();
        this.cookies[key] = value;
      }
    }
  }

  async request(method, urlPath, body = null, headers = {}) {
    const url = new URL(urlPath, this.baseUrl);
    const options = {
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const cookieStr = this.getCookieString();
    if (cookieStr) {
      options.headers['Cookie'] = cookieStr;
    }

    return new Promise((resolve, reject) => {
      const req = http.request(url, options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk;
        });

        res.on('end', () => {
          const setCookie = res.headers['set-cookie'];
          if (setCookie) {
            this.updateCookies(setCookie);
          }

          let json = null;
          if (res.headers['content-type']?.includes('application/json')) {
            try {
              json = JSON.parse(responseBody);
            } catch (e) {
              // Ignore JSON parse errors
            }
          }

          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: responseBody,
            json: json
          });
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      if (body) {
        req.write(typeof body === 'string' ? body : JSON.stringify(body));
      }
      req.end();
    });
  }

  async get(urlPath, headers = {}) {
    return this.request('GET', urlPath, null, headers);
  }

  async post(urlPath, body, headers = {}) {
    return this.request('POST', urlPath, body, headers);
  }

  async put(urlPath, body, headers = {}) {
    return this.request('PUT', urlPath, body, headers);
  }

  async patch(urlPath, body, headers = {}) {
    return this.request('PATCH', urlPath, body, headers);
  }

  async delete(urlPath, headers = {}) {
    return this.request('DELETE', urlPath, null, headers);
  }
}

// 3. Web Audio Context Mock
class MockAudioNode {
  constructor() {
    this.connections = [];
  }
  connect(destination) {
    this.connections.push(destination);
  }
  disconnect() {}
}

class MockAudioParam {
  constructor(defaultValue = 0) {
    this.value = defaultValue;
    this.history = [];
  }
  setValueAtTime(value, time) {
    this.value = value;
    this.history.push({ method: 'setValueAtTime', value, time });
  }
  setTargetAtTime(value, start, timeConstant) {
    this.value = value;
    this.history.push({ method: 'setTargetAtTime', value, start, timeConstant });
  }
  linearRampToValueAtTime(value, time) {
    this.value = value;
    this.history.push({ method: 'linearRampToValueAtTime', value, time });
  }
  exponentialRampToValueAtTime(value, time) {
    this.value = value;
    this.history.push({ method: 'exponentialRampToValueAtTime', value, time });
  }
}

class MockGainNode extends MockAudioNode {
  constructor() {
    super();
    this.gain = new MockAudioParam(1);
  }
}

class MockOscillatorNode extends MockAudioNode {
  constructor() {
    super();
    this.frequency = new MockAudioParam(440);
    this.type = 'sine';
  }
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
}

class MockBiquadFilterNode extends MockAudioNode {
  constructor() {
    super();
    this.frequency = new MockAudioParam(350);
    this.Q = new MockAudioParam(1);
    this.type = 'lowpass';
  }
}

class MockConvolverNode extends MockAudioNode {
  constructor() {
    super();
    this.buffer = null;
  }
}

class MockBufferSourceNode extends MockAudioNode {
  constructor() {
    super();
    this.buffer = null;
    this.loop = false;
    this.started = false;
    this.stopped = false;
  }
  start() {
    this.started = true;
  }
  stop() {
    this.stopped = true;
  }
}

class MockAudioBuffer {
  constructor(numberOfChannels, length, sampleRate) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.channelData = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }
  getChannelData(channel) {
    return this.channelData[channel];
  }
}

class MockAudioContext {
  constructor() {
    this.state = 'suspended';
    this.destination = new MockAudioNode();
    this.nodesCreated = [];
    this.sampleRate = 44100;
  }
  resume() {
    this.state = 'running';
    return Promise.resolve();
  }
  suspend() {
    this.state = 'suspended';
    return Promise.resolve();
  }
  createGain() {
    const node = new MockGainNode();
    this.nodesCreated.push({ type: 'gain', node });
    return node;
  }
  createOscillator() {
    const node = new MockOscillatorNode();
    this.nodesCreated.push({ type: 'oscillator', node });
    return node;
  }
  createBiquadFilter() {
    const node = new MockBiquadFilterNode();
    this.nodesCreated.push({ type: 'biquadFilter', node });
    return node;
  }
  createDelay() {
    const node = new MockAudioNode();
    this.nodesCreated.push({ type: 'delay', node });
    return node;
  }
  createConvolver() {
    const node = new MockConvolverNode();
    this.nodesCreated.push({ type: 'convolver', node });
    return node;
  }
  createBufferSource() {
    const node = new MockBufferSourceNode();
    this.nodesCreated.push({ type: 'bufferSource', node });
    return node;
  }
  createBuffer(numberOfChannels, length, sampleRate) {
    return new MockAudioBuffer(numberOfChannels, length, sampleRate);
  }
}

// Global exposure of mocks
global.MockAudioContext = MockAudioContext;
global.AudioContext = MockAudioContext;
global.window = global.window || {};
global.window.AudioContext = MockAudioContext;
global.window.setTimeout = setTimeout;
global.window.clearTimeout = clearTimeout;
global.window.setInterval = setInterval;
global.window.clearInterval = clearInterval;

// 4. Test Registration Framework
const suites = [];
let currentSuite = null;

global.describe = (name, fn) => {
  const suite = {
    name,
    tests: [],
    beforeAllFns: [],
    afterAllFns: [],
    beforeEachFns: [],
    afterEachFns: []
  };
  suites.push(suite);
  
  const parentSuite = currentSuite;
  currentSuite = suite;
  fn();
  currentSuite = parentSuite;
};

global.test = (name, fn) => {
  if (!currentSuite) {
    describe('Default Suite', () => {
      global.test(name, fn);
    });
    return;
  }
  currentSuite.tests.push({ name, fn });
};

global.it = global.test;

global.beforeAll = (fn) => {
  if (currentSuite) currentSuite.beforeAllFns.push(fn);
};

global.afterAll = (fn) => {
  if (currentSuite) currentSuite.afterAllFns.push(fn);
};

global.beforeEach = (fn) => {
  if (currentSuite) currentSuite.beforeEachFns.push(fn);
};

global.afterEach = (fn) => {
  if (currentSuite) currentSuite.afterEachFns.push(fn);
};

// Assertion library
class Assertion {
  constructor(actual) {
    this.actual = actual;
    this.isNot = false;
  }

  get not() {
    this.isNot = true;
    return this;
  }

  _check(passed, message) {
    if (this.isNot) {
      passed = !passed;
      message = `not ${message}`;
    }
    if (!passed) {
      throw new Error(message);
    }
  }

  toBe(expected) {
    this._check(
      Object.is(this.actual, expected),
      `Expected ${JSON.stringify(this.actual)} to be ${JSON.stringify(expected)}`
    );
  }

  toEqual(expected) {
    const actualStr = JSON.stringify(this.actual);
    const expectedStr = JSON.stringify(expected);
    this._check(
      actualStr === expectedStr,
      `Expected ${actualStr} to equal ${expectedStr}`
    );
  }

  toContain(expected) {
    const passed = Array.isArray(this.actual) || typeof this.actual === 'string'
      ? this.actual.includes(expected)
      : false;
    this._check(
      passed,
      `Expected ${JSON.stringify(this.actual)} to contain ${JSON.stringify(expected)}`
    );
  }

  toBeTruthy() {
    this._check(
      !!this.actual,
      `Expected ${JSON.stringify(this.actual)} to be truthy`
    );
  }

  toBeFalsy() {
    this._check(
      !this.actual,
      `Expected ${JSON.stringify(this.actual)} to be falsy`
    );
  }

  toBeGreaterThan(expected) {
    this._check(
      this.actual > expected,
      `Expected ${this.actual} to be greater than ${expected}`
    );
  }

  toBeLessThan(expected) {
    this._check(
      this.actual < expected,
      `Expected ${this.actual} to be less than ${expected}`
    );
  }

  toBeGreaterThanOrEqual(expected) {
    this._check(
      this.actual >= expected,
      `Expected ${this.actual} to be greater than or equal to ${expected}`
    );
  }

  toBeLessThanOrEqual(expected) {
    this._check(
      this.actual <= expected,
      `Expected ${this.actual} to be less than or equal to ${expected}`
    );
  }

  toBeDefined() {
    this._check(
      this.actual !== undefined,
      `Expected value to be defined`
    );
  }

  toBeUndefined() {
    this._check(
      this.actual === undefined,
      `Expected value to be undefined`
    );
  }

  toThrow(expectedErrorPattern) {
    let thrown = false;
    let thrownError = null;
    try {
      this.actual();
    } catch (e) {
      thrown = true;
      thrownError = e;
    }

    if (expectedErrorPattern) {
      const match = thrownError && (
        thrownError.message.includes(expectedErrorPattern) ||
        (expectedErrorPattern instanceof RegExp && expectedErrorPattern.test(thrownError.message))
      );
      this._check(
        match,
        `Expected function to throw error matching ${expectedErrorPattern}, but got ${thrownError ? thrownError.message : 'no error'}`
      );
    } else {
      this._check(
        thrown,
        `Expected function to throw an error`
      );
    }
  }
}

global.expect = (actual) => new Assertion(actual);
global.TestAgent = TestAgent;

// 5. Test Runner Execution
async function runTests() {
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  const failures = [];

  console.log(`\nStarting Custom E2E Test Suite...\n`);

  for (const suite of suites) {
    console.log(`Suite: ${suite.name}`);
    
    // Run beforeAll hooks
    for (const fn of suite.beforeAllFns) {
      try {
        await fn();
      } catch (err) {
        console.error(`Error in beforeAll hook of suite ${suite.name}:`, err);
      }
    }

    for (const testItem of suite.tests) {
      totalTests++;
      
      // Run beforeEach hooks
      for (const fn of suite.beforeEachFns) {
        try {
          await fn();
        } catch (err) {
          console.error(`Error in beforeEach hook:`, err);
        }
      }

      console.log(`  Running test: ${testItem.name}`);
      try {
        await testItem.fn();
        passedTests++;
        console.log(`  ✓ Passed`);
      } catch (err) {
        failedTests++;
        failures.push({
          suite: suite.name,
          test: testItem.name,
          error: err
        });
        console.log(`  ✗ Failed: ${err.message}`);
      }

      // Run afterEach hooks
      for (const fn of suite.afterEachFns) {
        try {
          await fn();
        } catch (err) {
          console.error(`Error in afterEach hook:`, err);
        }
      }
    }

    // Run afterAll hooks
    for (const fn of suite.afterAllFns) {
      try {
        await fn();
      } catch (err) {
        console.error(`Error in afterAll hook of suite ${suite.name}:`, err);
      }
    }
  }

  console.log(`\n=== E2E Test Summary ===`);
  console.log(`Total:  ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failedTests}`);
  console.log(`========================\n`);

  if (failures.length > 0) {
    console.log(`--- Failures Detail ---`);
    failures.forEach((f, idx) => {
      console.log(`${idx + 1}) [${f.suite}] ${f.test}`);
      console.log(`   Error: ${f.error.message}`);
      if (f.error.stack) {
        console.log(f.error.stack.split('\n').slice(1, 4).join('\n'));
      }
    });
    console.log(`-----------------------\n`);
  }

  return { totalTests, passedTests, failedTests };
}

const routeFiles = [];
const originalContents = {};

function getRouteFiles(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getRouteFiles(fullPath);
    } else if (file === 'route.ts') {
      routeFiles.push(fullPath);
    }
  }
}

function disableEdgeRuntime() {
  try {
    console.log('Scanning API routes for Edge runtime...');
    const apiDir = path.join(__dirname, '../../src/app/api');
    getRouteFiles(apiDir);
    
    const layoutFile = path.join(__dirname, '../../src/app/layout.tsx');
    if (fs.existsSync(layoutFile)) {
      routeFiles.push(layoutFile);
    }
    
    console.log(`Found ${routeFiles.length} files. Temporarily disabling Edge runtime...`);
    for (const file of routeFiles) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.includes('export const runtime = "edge";')) {
        originalContents[file] = content;
        const modified = content.replace('export const runtime = "edge";', '// export const runtime = "edge";');
        fs.writeFileSync(file, modified, 'utf8');
      }
    }
  } catch (err) {
    console.error('Error disabling Edge runtime:', err);
  }
}

function restoreEdgeRuntime() {
  try {
    const keys = Object.keys(originalContents);
    if (keys.length === 0) return;
    console.log(`Restoring Edge runtime for ${keys.length} route files...`);
    for (const file of keys) {
      fs.writeFileSync(file, originalContents[file], 'utf8');
    }
    // Clear originalContents
    for (const key of keys) {
      delete originalContents[key];
    }
  } catch (err) {
    console.error('Error restoring Edge runtime:', err);
  }
}

// Register exit handlers to ensure cleanup
process.on('SIGINT', () => {
  console.log('\nProcess interrupted.');
  restoreEdgeRuntime();
  killPort3000();
  process.exit(1);
});
process.on('SIGTERM', () => {
  console.log('\nProcess terminated.');
  restoreEdgeRuntime();
  killPort3000();
  process.exit(1);
});
process.on('uncaughtException', (err) => {
  console.error('\nUncaught Exception:', err);
  restoreEdgeRuntime();
  killPort3000();
  process.exit(1);
});

// 6. Main Orchestrator
async function main() {
  killPort3000();
  disableEdgeRuntime();

  try {
    const nextDir = path.join(__dirname, '../../.next');
    if (fs.existsSync(nextDir)) {
      console.log('Cleaning Next.js cache (.next)...');
      fs.rmSync(nextDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.error('Failed to clean .next cache:', err);
  }

  try {
    console.log('Cleaning database...');
    execSync('node scripts/db-clean.js', { stdio: 'inherit' });
  } catch (err) {
    console.error('Failed to clean database:', err);
  }

  let devServerProcess = null;

  try {
    // Start dev server
    devServerProcess = await new Promise((resolve, reject) => {
      console.log('Starting Next.js dev server (npm run dev)...');
      
      const server = spawn('npm', ['run', 'dev'], {
        shell: true,
        env: { ...process.env, PORT: '3000', LUMIN_TEST: 'true' }
      });

      server.stdout.on('data', (data) => {
        console.log(`[DevServer] ${data.toString().trim()}`);
      });

      server.stderr.on('data', (data) => {
        console.error(`[DevServer Error] ${data.toString().trim()}`);
      });

      // Poll localhost:3000
      const pollInterval = 1000;
      const maxRetries = 45;
      let retries = 0;

      const checkServer = () => {
        http.get('http://localhost:3000', (res) => {
          console.log(`Next.js dev server is ready! Status: ${res.statusCode}`);
          resolve(server);
        }).on('error', (err) => {
          retries++;
          if (retries >= maxRetries) {
            server.kill();
            reject(new Error(`Server not ready after ${maxRetries} attempts: ${err.message}`));
          } else {
            setTimeout(checkServer, pollInterval);
          }
        });
      };

      setTimeout(checkServer, 1500);
    });

    // Load tests
    console.log('Loading tests...');
    require('./tier1.test.js');
    require('./tier2.test.js');
    require('./tier3.test.js');
    require('./tier4.test.js');

    // Run tests
    const results = await runTests();
    
    // Clean up
    console.log('Stopping dev server...');
    killPort3000();
    restoreEdgeRuntime();
    
    process.exit(0);

  } catch (err) {
    console.error('Fatal error during test run:', err);
    killPort3000();
    restoreEdgeRuntime();
    process.exit(1);
  }
}

main();
