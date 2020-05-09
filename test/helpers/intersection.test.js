import {isCenterOfAInsideB} from '../../src/helpers/intersection';

describe("intersection - isCenterOfAInsideB", () => {
   test("centre is inside", () => {
       const elA = document.createElement('div');
       elA.style.height = '50px';
       elA.style.width = '50px';
       document.body.appendChild(elA);
       expect(isCenterOfAInsideB(elA, document.body)).toBe(true);
   })
});