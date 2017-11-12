import APIUtils from './api-utils'

// declare module "*.json" {
//     const value: any;
//     export default value;
// }

export type Address = {
  building_number: number|string
  flat_number?: string
  street: string
  sub_street?: string
  town: string
  postcode: string
  country: string
}

// export type OnfidoName = {
//   first_name: string
//   last_name: string
// }

export type ApplicantProps = {
  first_name?: string
  last_name?: string
  email?: string
  gender?: string
  dob?:string
  addresses?: Address[]
}

export type Document = {
  link: string
  type: string
  file: Buffer
  filename: string
  side?: string
}

type Buffer = {
  type: string
  data: number[]
}

export type Photo = {
  link: string
  file: Buffer
  filename: string
}

export interface ILogger {
  log: Function
  info: Function
  warn: Function
  debug: Function
  error: Function
}

export type PluginOpts = {
  logger: ILogger
  onfidoAPI: any
  productsAPI: any
  products: string[]
  formsToRequestCorrectionsFor: string[]
  // onFinished: Function
  padApplicantName?: boolean
  webhookKey?: string
  preCheckAddress?: boolean
}

export interface IOnfidoComponent {
  logger: ILogger
  onfidoAPI:any
  productsAPI:any
  apiUtils: APIUtils
  models?: any
}

export type OnfidoAddress = {
  building_number: number|string
  street: string
  town: string
  postcode: string
  sub_street?: string
  flat_number?: string
}

export type OnfidoState = {
  application: any
  state: any
  // incoming form
  req?: any
  form?: any
}

export type IncomingFormReq = {
  req: any
  application: any
  state: any
  form?: any
}

export type CheckMapping = {
  application: string
  state: string
  check: string
}
