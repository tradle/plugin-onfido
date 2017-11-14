const opResult = {
  type: 'tradle.Model',
  id: 'onfido.OpResult',
  subClassOf: 'tradle.Enum',
  title: 'Onfido Operation Status',
  description: 'status of an Onfido operation: a report or a check',
  properties: {
    result: {
      type: 'string'
    }
  },
  enum: [
    { id: 'clear', title: 'Success' },
    { id: 'consider', title: 'Failure' },
    { id: 'unidentified', title: 'No matches' },
  ]
}

const checkStatus = {
  type: 'tradle.Model',
  id: 'onfido.CheckStatus',
  subClassOf: 'tradle.Enum',
  title: 'Onfido Operation Status',
  description: 'status of an Onfido operation: a report or a check',
  properties: {
    status: {
      type: 'string'
    }
  },
  enum: [
    { id: 'inprogress', title: 'In progress' },
    { id: 'awaitingapplicant', title: 'Awaiting applicant' },
    { id: 'complete', title: 'Complete' },
    { id: 'withdrawn', title: 'Withdrawn' },
    { id: 'paused', title: 'Paused' },
    { id: 'reopened', title: 'Reopened' }
  ]
}

const reportStatus = {
  type: 'tradle.Model',
  id: 'onfido.ReportStatus',
  subClassOf: 'tradle.Enum',
  title: 'Onfido Report Status',
  description: 'status of an Onfido report',
  properties: {
    status: {
      type: 'string'
    }
  },
  enum: [
    { id: 'awaitingdata', title: 'Awaiting approval' },
    { id: 'awaitingapproval', title: 'Awaiting approval' },
    { id: 'complete', title: 'Complete' },
    { id: 'withdrawn', title: 'Withdrawn' },
    { id: 'paused', title: 'Paused' }
  ]
}

const reportType = {
  type: 'tradle.Model',
  id: 'onfido.ReportType',
  subClassOf: 'tradle.Enum',
  title: 'Onfido Report Type',
  properties: {
    type: {
      type: 'string'
    }
  },
  enum: [
    { id: 'document', title: 'Document' },
    { id: 'facialsimilarity', title: 'Facial Similarity' },
    { id: 'identity', title: 'Identity' }
  ]
}

const check = {
  type: 'tradle.Model',
  id: 'onfido.Check',
  title: 'Onfido Check',
  properties: {
    rawData: {
      type: 'object',
      range: 'json'
    },
    reportsOrdered: {
      type: 'array',
      inlined: true,
      items: {
        ref: reportType.id
      }
    },
    // // to avoid looking up reports
    // reportsResults: {
    //   type: 'array',
    //   inlined: true,
    //   items: {
    //     ref: reportStatus.id
    //   }
    // },
    status: {
      type: 'object',
      ref: checkStatus.id
    },
    result: {
      type: 'object',
      ref: opResult.id
    },
    applicantId: {
      type: 'string'
    },
    checkId: {
      type: 'string'
    }
  }
}

// for the state machine
// const processStatus = {
//   type: 'tradle.Model',
//   id: 'onfido.ProcessStatus',
//   subClassOf: 'tradle.Enum',
//   title: 'Onfido Process Status',
//   properties: {
//     status: {
//       type: 'string'
//     }
//   },
//   enum: [
//     { id: 'initial', title: 'initial' },
//     { id: 'applicantcreated', title: 'Applicant Created' },
//     { id: 'selfieuploaded', title: 'Selfie Uploaded' },
//     { id: 'documentuploaded', title: 'Document Uploaded' },
//     { id: 'checkpending', title: 'Check Pending' },
//     { id: 'checkcompleted', title: 'Check Completed' },
//     { id: 'error', title: 'Error' }
//   ]
// }

const state = {
  type: 'tradle.Model',
  id: 'onfido.ApplicationState',
  title: 'Onfido Application State',
  properties: {
    applicant: {
      type: 'object',
      ref: 'tradle.Identity'
    },
    application: {
      type: 'object',
      ref: 'tradle.Application'
    },
    onfidoApplicant: {
      type: 'object',
      range: 'json'
    },
    selfie: {
      type: 'object',
      ref: 'tradle.Selfie'
    },
    photoID: {
      type: 'object',
      ref: 'tradle.PhotoID'
    },
    applicantDetails: {
      type: 'array',
      items: {
        ref: 'tradle.Form'
      }
    },
    check: {
      type: 'object',
      ref: check.id
    },
    checkStatus: {
      type: 'object',
      ref: checkStatus.id
    },
    errors: {
      type: 'object',
      range: 'json'
    },
    result: {
      type: 'object',
      ref: opResult.id
    }
  }
}

const stateStub = {
  type: 'tradle.Model',
  id: 'onfido.ApplicationStateStub',
  title: 'Onfido Application State Stub',
  inlined: true,
  properties: {
    application: {
      type: 'object',
      ref: 'tradle.Application'
    },
    state: {
      type: 'object',
      ref: state.id
    },
    // applicantCreated: {
    //   type: 'boolean'
    // },
    // selfieUploaded: {
    //   type: 'boolean'
    // },
    // photoIDUploaded: {
    //   type: 'boolean'
    // },
    // checkCreated: {
    //   type: 'boolean'
    // }
    //  status: {
    //   type: 'object',
    //   ref: processStatus.id
    // }
  }
}

const models = {
  reportStatus,
  checkStatus,
  opResult,
  reportType,
  check,
  // processStatus,
  state,
  stateStub,
  all: {}
}

for (let name in models) {
  if (name !== 'all') {
    let model = models[name]
    models.all[model.id] = model
  }
}

export default models
