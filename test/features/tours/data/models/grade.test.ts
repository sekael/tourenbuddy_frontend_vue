import { describe, expect, it } from 'vitest'
import { dropScales, gradeLeads, gradeScales, normalizeGrade, toggleGrade } from '@/features/tours/data/models/grade'

describe('gradeScales', () => {
  it('should offer a shared scale once, led by the first activity using it', () => {
    expect(gradeScales(['hiking', 'trailrunning'])).toEqual([{ type: 'hiking', grades: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'] }])
  })

  it('should offer each scale of mixed activities in activity order', () => {
    expect(gradeScales(['mountain-biking', 'skitour']).map(s => s.grades[0])).toEqual(['L', 'S0'])
  })

  it('should offer nothing where no single scale is in use', () => {
    expect(gradeScales(['climbing', 'skiing', 'snowboarding', 'paragliding'])).toEqual([])
    expect(gradeScales([])).toEqual([])
  })
})

describe('toggleGrade', () => {
  it('should keep the other scale\'s part when a second scale\'s chip is tapped', () => {
    expect(toggleGrade('T3', 'S2')).toBe('T3, S2')
  })

  it('should replace only its own scale\'s part, modifier and all', () => {
    expect(toggleGrade('ZS-, 5c', 'WS')).toBe('WS, 5c')
  })

  it('should clear its part when the chip is lit, whatever the case or modifier', () => {
    expect(toggleGrade('zs+, T4', 'ZS')).toBe('T4')
  })

  it('should tell the alpine S from the singletrail S2', () => {
    expect(toggleGrade('S', 'S2')).toBe('S, S2')
    expect(toggleGrade('S, S2', 'S')).toBe('S2')
  })

  it('should leave hand-typed text no scale knows', () => {
    expect(toggleGrade('schwer', 'T3')).toBe('schwer, T3')
  })
})

describe('gradeLeads', () => {
  it('should light a range by its first grade and ignore words that merely start like one', () => {
    expect(gradeLeads('WS+/ZS-, Schwer, ex')).toEqual(['WS', 'EX'])
  })
})

describe('dropScales', () => {
  it('should drop the gone scale\'s part and keep the rest', () => {
    const [singletrail] = gradeScales(['mountain-biking'])
    expect(dropScales('T3, S2+, 5c', [singletrail!])).toBe('T3, 5c')
  })
})

describe('normalizeGrade', () => {
  it('should capitalise scale grades only, keeping climbing letters as typed', () => {
    expect(normalizeGrade('  zs+ ;6a+ · t4 ')).toBe('ZS+, 6a+, T4')
  })

  it('should turn separators alone into nothing', () => {
    expect(normalizeGrade(' , ')).toBe('')
  })
})
