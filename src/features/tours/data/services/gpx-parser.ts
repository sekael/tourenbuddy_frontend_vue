import { gpx } from '@tmcw/togeojson'

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

export class GpxParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GpxParseError'
  }
}

export class GpxFileTooLargeError extends Error {
  constructor() {
    super(`GPX file must be smaller than 5 MB`)
    this.name = 'GpxFileTooLargeError'
  }
}

/**
 * Parses a GPX File into a GeoJSON FeatureCollection.
 *
 * @throws {GpxFileTooLargeError} if the file exceeds 5 MB
 * @throws {GpxParseError} if the file is not valid GPX XML
 */
export async function parseGpxFile(file: File): Promise<GeoJSON.FeatureCollection> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new GpxFileTooLargeError()
  }

  const text = await file.text()

  let doc: Document
  try {
    const parser = new DOMParser()
    doc = parser.parseFromString(text, 'application/xml')

    const parserError = doc.querySelector('parsererror')
    if (parserError) {
      throw new GpxParseError('Invalid XML in GPX file')
    }
  }
  catch (err) {
    if (err instanceof GpxParseError)
      throw err
    throw new GpxParseError('Failed to parse GPX file')
  }

  const geojson = gpx(doc)

  if (!geojson || !geojson.features || geojson.features.length === 0) {
    throw new GpxParseError('GPX file contains no track data')
  }

  return geojson
}
