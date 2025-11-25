import fs from 'fs';
import path from 'path';

class Logger {
  private logFilePath: string;
  private logStream: fs.WriteStream;

  constructor() {
    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Create log file with Beijing timestamp (UTC+8)
    const now = new Date();
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const timestamp = beijingTime.toISOString().replace(/[:.]/g, '-').split('T').join('_').slice(0, -5);
    this.logFilePath = path.join(logsDir, `bot_${timestamp}.log`);
    this.logStream = fs.createWriteStream(this.logFilePath, { flags: 'a' });

    console.log(`📝 日志文件: ${this.logFilePath}`);
  }

  writeToFile(message: string) {
    // Convert to Beijing time (UTC+8)
    const now = new Date();
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const timestamp = beijingTime.toISOString().replace('Z', '+08:00');
    this.logStream.write(`[${timestamp}] ${message}\n`);
  }

  log(...args: any[]) {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    console.log(...args);
    this.writeToFile(message);
  }

  error(...args: any[]) {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    console.error(...args);
    this.writeToFile(`ERROR: ${message}`);
  }

  warn(...args: any[]) {
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    
    console.warn(...args);
    this.writeToFile(`WARN: ${message}`);
  }

  close() {
    this.logStream.end();
  }

  getLogFilePath(): string {
    return this.logFilePath;
  }
}

// Create singleton instance
export const logger = new Logger();

// Override global console methods
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

console.log = (...args: any[]) => {
  originalLog(...args);
  const message = args.map(arg => {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    return typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg);
  }).join(' ');
  logger.writeToFile(message);
};

console.error = (...args: any[]) => {
  originalError(...args);
  const message = args.map(arg => {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    return typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg);
  }).join(' ');
  logger.writeToFile(`ERROR: ${message}`);
};

console.warn = (...args: any[]) => {
  originalWarn(...args);
  const message = args.map(arg => {
    if (arg === null) return 'null';
    if (arg === undefined) return 'undefined';
    return typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg);
  }).join(' ');
  logger.writeToFile(`WARN: ${message}`);
};

// Handle process exit
process.on('exit', () => {
  logger.close();
});

process.on('SIGINT', () => {
  logger.close();
  process.exit(0);
});

export default logger;
