import { ILogger } from '../types'

export default class ConsoleLogger implements ILogger {
  public log = console.log.bind(console)
  public info = console.info.bind(console)
  public warn = console.warn.bind(console)
  public debug = console.log.bind(console)
  public error = console.error.bind(console)
}
