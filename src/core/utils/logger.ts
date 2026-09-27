import winston from 'winston';
import fs from 'fs';

if (!fs.existsSync('logs')) {
  fs.mkdirSync('logs');
}

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    return `${timestamp} [${level}]: ${message} ${
      Object.keys(meta).length ? JSON.stringify(meta) : ''
    }`;
  })
);

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  transports: [
    new winston.transports.Console(),
    // ✅ تحسين: تحديد حجم أقصى لكل ملف لوج + عدد نسخ محدود (rotation).
    // من غير الحد ده، ملفات اللوج بتكبر من غير نهاية مع الوقت لحد ما
    // تملي مساحة القرص وتوقف السيرفر عن الشغل. دلوقتي كل ملف بيوصل
    // لحد 5 ميجا وبعدها بيتعمله rotate تلقائي لحد 5 نسخ قديمة كحد أقصى.
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: winston.format.uncolorize(),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
      tailable: true
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: winston.format.uncolorize(),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
      tailable: true
    })
  ]
});

export default logger;