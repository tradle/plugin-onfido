import parseDataUri = require('parse-data-uri')
import applicants = require('./applicants')
import checks = require('./checks')
import documents = require('./documents')
import documentImages = require('./document-images')
import tradle = require('./tradle')
import inputs = require('./inputs')

inputs.license.file = parseDataUri(inputs.license.file).data
inputs.selfie.file = parseDataUri(inputs.selfie.file).data

export default {
  applicants,
  checks,
  documents,
  documentImages,
  tradle,
  inputs
}
