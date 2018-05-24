import APIUtils from './api-utils'

// declare module "*.json" {
//     const value: any;
//     export default value;
// }

export type OnfidoResult = 'clear' | 'consider'

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
  silly: Function
  debug: Function
  info: Function
  warn: Function
  error: Function
}

export type ProductOptions = {
  product: string,
  reports?: string[]
}

export type PluginOpts = {
  logger: ILogger
  bot: any
  onfidoAPI: any
  applications: any
  products: ProductOptions[]
  formsToRequestCorrectionsFor: string[]
  // onFinished: Function
  padApplicantName?: boolean
  webhookKey?: string
  preCheckAddress?: boolean
}

export interface IOnfidoComponent {
  logger: ILogger
  onfidoAPI:any
  applications:any
  apiUtils: APIUtils
  models?: any
}

export type OnfidoAddress = {
  country: string
  building_number: number|string
  street: string
  town: string
  postcode: string
  sub_street?: string
  flat_number?: string
}

export type Check = {
  application: any
  selfie: any
  photoID: any
  rawData: any
  errors: any
  reportsOrdered: any[]
  status: any
  onfidoStatus: any
  onfidoResult: any
  onfidoApplicant: any
  onfidoCheckId: string
}

export type Resource = {
  get(key: string): any
  set(key: string, value: any): void
  set(props: any): void
  save():Promise<any|void>
  sign():Promise<any|void>
  signAndSave():Promise<any|void>
  toJSON(opts: any): any
  isModified(): boolean
}

export type OnfidoState = {
  application: any
  check: Resource
  // incoming form
  req?: any
  form?: any
}

export type IncomingFormReq = {
  req: any
  application: any
  check?: Resource
  form?: any
}

// export type CheckMapping = {
//   application: string
//   state: string
//   check: string
// }
