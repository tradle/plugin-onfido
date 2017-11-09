const opStatus = {
  type: 'tradle.Model',
  id: 'onfido.Status',
  subClassOf: 'tradle.Enum',
  title: 'Onfido Operation Status',
  description: 'status of an Onfido operation: a report or a check',
  properties: {
    status: {
      type: 'string'
    }
  },
  enum: [
    { id: 'pending', title: 'Pending' },
    { id: 'clear', title: 'Success' },
    { id: 'consider', title: 'Failure' },
    { id: 'error', title: 'Error' }
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
    { id: 'face', title: 'Facial Similarity' },
    { id: 'identity', title: 'Identity' }
  ]
}

const check = {
  type: 'tradle.Model',
  id: 'onfido.Check',
  title: 'Onfido Check',
  properties: {
    reportsOrdered: {
      type: 'array',
      inlined: true,
      items: {
        ref: reportType.id
      }
    },
    // to avoid looking up reports
    reportsResults: {
      type: 'array',
      inlined: true,
      items: {
        ref: opStatus.id
      }
    },
    status: {
      type: 'object',
      ref: opStatus.id
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
    status: {
      type: 'object',
      ref: opStatus.id
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
    pendingCheck: {
      type: 'object',
      ref: check.id
    },
    pendingCheckStatus: {
      type: 'object',
      ref: opStatus.id
    },
    errors: {
      type: 'array',
      items: {
        type: 'object',
        range: 'json'
      }
    },
    result: {
      type: 'object',
      range: 'json',
      description: 'raw result from Onfido'
    }
  }
}

const stateStub = {
  type: 'tradle.Model',
  id: 'onfido.ApplicationState',
  title: 'Onfido Application State',
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
  opStatus,
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
