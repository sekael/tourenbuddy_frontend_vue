import { describe, expect, it } from 'vitest'
import { gradeScales } from '@/features/tours/data/models/grade'

describe('gradeScales', () => {
  it('should offer a shared scale once', () => {
    expect(gradeScales(['hiking', 'trailrunning'])).toEqual([['T1', 'T2', 'T3', 'T4', 'T5', 'T6']])
  })

  it('should offer each scale of mixed activities in activity order', () => {
    expect(gradeScales(['mountain-biking', 'skitour']).map(scale => scale[0])).toEqual(['L', 'S0'])
  })

  it('should offer nothing where no single scale is in use', () => {
    expect(gradeScales(['climbing', 'skiing', 'snowboarding', 'paragliding'])).toEqual([])
    expect(gradeScales([])).toEqual([])
  })
})
