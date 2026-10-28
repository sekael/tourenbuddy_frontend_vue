import { describe, expect, it } from 'vitest'
import { dropScales, gradeInRanges, gradeLeads, gradeScales, normalizeGrade, tapGradeRange, toggleGrade } from '@/features/tours/data/models/grade'

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

describe('tapGradeRange', () => {
  it('should pick one, widen to a second tap in scale order, then restart', () => {
    const one = tapGradeRange([], 'T4')
    const wide = tapGradeRange(one, 'T2')
    expect(wide).toEqual([{ from: 'T2', to: 'T4' }])
    expect(tapGradeRange(wide, 'T3')).toEqual([{ from: 'T3', to: 'T3' }])
  })

  it('should clear a lone pick and leave the other scales alone', () => {
    const ranges = tapGradeRange(tapGradeRange([], 'S2'), 'T3')
    expect(tapGradeRange(ranges, 'T3')).toEqual([{ from: 'S2', to: 'S2' }])
  })

  it('should keep the alpine S apart from the singletrail S2', () => {
    expect(tapGradeRange([{ from: 'S2', to: 'S2' }], 'S')).toHaveLength(2)
  })
})

describe('gradeInRanges', () => {
  it('should count a modifier as its base grade', () => {
    const ranges = [{ from: 'WS', to: 'ZS' }]
    expect(['WS-', 'zs+', 'ZS+ (III)'].map(g => gradeInRanges(g, ranges))).toEqual([true, true, true])
    expect(gradeInRanges('S-', ranges)).toBe(false)
  })

  it('should never match free text, no grade, or a grade only on an unfiltered scale', () => {
    const ranges = [{ from: 'T1', to: 'T6' }]
    expect([gradeInRanges('5c', ranges), gradeInRanges(null, ranges), gradeInRanges('S1', ranges)]).toEqual([false, false, false])
  })

  it('should fail a bike-and-hike whose filtered part is out of range', () => {
    expect(gradeInRanges('S2, T4', [{ from: 'T1', to: 'T3' }])).toBe(false)
    expect(gradeInRanges('S2, T4', [{ from: 'S0', to: 'S2' }])).toBe(true)
    expect(gradeInRanges('S2, T4', [{ from: 'S0', to: 'S2' }, { from: 'T1', to: 'T3' }])).toBe(false)
  })
})
