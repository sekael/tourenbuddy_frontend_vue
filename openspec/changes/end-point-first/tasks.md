# Tasks

## 1. Tour form

- [x] 1.1 `tour-form`: render the end point section without a start (create, edit, suggest)
- [x] 1.2 `tour-form`: render "Round Trip" only while a start is set
- [x] 1.3 `tour-form`: a picked GPX fills no point within 200 m of the goal; a loop needs a start
- [x] 1.4 `point-suggestions`: a landing card's history takes only tours that landed

## 2. Verification

- [x] 2.1 Tests: a new form offers the end without a start and no Round Trip (a lone glider:
      "Add landing"); Round Trip shows once a start is set; removing the end of a stage without
      a start brings back the empty end section; a GPX from or up to the goal fills no point
      there; a landing card skips an earlier hike's end
- [x] 2.2 `npx eslint . --fix`, `npm run type-check`, `npm run test`
- [x] 2.3 Independent review until no findings remain
