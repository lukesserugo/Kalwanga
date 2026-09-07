import { app } from 'electron';
import path from 'path';
import fs from 'fs';

const LOG_FILE = path.join(app.getPath('userData'), 'logs', 'app.log');

// Ensure log directory exists
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const levels = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = process.env.LOG_LEVEL || 'info';

const colors = {
  error: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[36m',
  debug: '\x1b[32m',
  reset: '\x1b[0m',
};

function getTimestamp(): string {
  return new Date().toISOString();
}

function formatMessage(level: string, message: string, ...args: any[]): string {
  const timestamp = getTimestamp();
  const formattedArgs = args.length > 0
    ? ' ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : arg).join(' ')
    : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${formattedArgs}`;
}

function writeLog(level: string, message: string, ...args: any[]): void {
  const formatted = formatMessage(level, message, ...args);
  const color = colors[level as keyof typeof colors] || colors.info;

  if (levels[level as keyof typeof levels] <= levels[currentLevel as keyof typeof levels]) {
    console.log(`${color}${formatted}${colors.reset}`);
    fs.appendFileSync(LOG_FILE, formatted + '\n');
  }
}

export const logger = {
  error: (message: string, ...args: any[]) => writeLog('error', message, ...args),
  warn: (message: string, ...args: any[]) => writeLog('warn', message, ...args),
  info: (message: string, ...args: any[]) => writeLog('info', message, ...args),
  debug: (message: string, ...args: any[]) => writeLog('debug', message, ...args),
};
