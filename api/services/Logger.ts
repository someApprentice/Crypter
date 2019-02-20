import { createLogger, format, transports } from 'winston';

const { combine, colorize, timestamp, errors, printf } = format;

const logger = createLogger({
  format: combine(
    format(info => {
      info.level = info.level.toUpperCase();

      return info;
    })(),
    timestamp(),
    errors({ stack: true }),
    printf(info => {
      return `[${info.timestamp}] ${info.level}: ${info.message}\n  ${info.stack}`;
    })
  ),
  transports: [
    new transports.Console({
      format: combine(
        format.colorize(),
        printf(info => {
          return `[${info.timestamp}] ${info.level}: ${info.message}\n  ${info.stack}`;
        })
      )
    }),
    new transports.File({ filename: 'error.log' })
  ]
});

export default logger;