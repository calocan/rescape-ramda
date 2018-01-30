/**
 * Created by Andy Likuski on 2017.07.03
 * Copyright (c) 2017 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the 'Software'), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

const pureReqPath = require('./functions').reqPath;
const {throwIfLeft, mappedThrowIfLeft, reqPathThrowing, reqStrPathThrowing, reqPathPropEqThrowing, findOneThrowing, onlyOneThrowing, onlyOneValueThrowing, findOneValueByParamsThrowing} = require('./throwingFunctions');
const {Either} = require('ramda-fantasy');
const R = require('ramda');

describe('throwingFunctions', () => {
  test('throwIfLeft', () => {
    // Use a pure function that returns Either. throwIfLeft should throw if the either is an EitherLeft
    expect(throwIfLeft(pureReqPath(['a'], {a: 1}))).toBe(1);
    expect(() => throwIfLeft(pureReqPath(['a', 'b'], {a: {c: 1}}))).toThrow();
  });

  test('mappedThrowIfLeft', () => {
    // Use a pure function that returns Either. throwIfLeft should throw if the either is an EitherLeft
    expect(mappedThrowIfLeft(() => null, pureReqPath(['a'], {a: 1}))).toBe(1);
    expect(() => mappedThrowIfLeft(arg => `Error ${arg}`, Either.Left([1, 2]))).toThrow(
      'Error 1; Error 2'
    );
  });

  test('reqPathThrowing', () => {
    expect(reqPathThrowing(['a'], {a: 1})).toBe(1);
    expect(() => reqPathThrowing(['a', 'b'], {a: {c: 1}})).toThrow();
  });

  test('reqStrPathThrowing', () => {
    expect(reqStrPathThrowing('foo.bar.goo', {
      foo: {
        bar: {
          goo: 1
        }
      }
    })).toEqual(1);

    expect(() => reqStrPathThrowing('foo.bar.goo', {
      foo: {
        car: {
          goo: 1
        }
      }
    })).toThrow();
  });

  test('reqPathPropEqThrowing', () => {
    expect(reqPathPropEqThrowing(['a'], 1, {a: 1})).toBe(true);
    expect(() => reqPathPropEqThrowing(['a', 'b'], 1, {a: {c: 1}})).toThrow();
  });

  test('findOneThrowing', () => {
    // Works with objects
    expect(
      findOneThrowing(R.equals('Eli Whitney'), {a: 1, b: 'Eli Whitney'})
    ).toEqual(
      {b: 'Eli Whitney'}
    );

    // Works with arrays
    expect(
      findOneThrowing(R.equals('Eli Whitney'), [1, 'Eli Whitney'])
    ).toEqual(
      ['Eli Whitney']
    );

    // None
    expect(
      () => findOneThrowing(R.equals('Eli Whitney'), {a: 1, b: 2})
    ).toThrow();

    // Too many
    expect(
      () => findOneThrowing(R.equals('Eli Whitney'), {a: 'Eli Whitney', b: 'Eli Whitney'})
    ).toThrow();
  });

  test('onlyOneThrowing', () => {
    expect(
      onlyOneThrowing({a: 'Eli Whitney'})).
    toEqual(
      {a: 'Eli Whitney'}
    );

    // None
    expect(
      () => onlyOneThrowing({})
    ).toThrow();

    // Too many
    expect(
      () => onlyOneThrowing({a: 'Eli Whitney', b: 'Eli Whitney'})
    ).toThrow();
  });

  test('onlyOneValueThrowing', () => {
    expect(
      onlyOneValueThrowing({a: 'Eli Whitney'})).
    toEqual(
      'Eli Whitney'
    );

    // None
    expect(
      () => onlyOneValueThrowing({})
    ).toThrow();

    // Too many
    expect(
      () => onlyOneValueThrowing({a: 'Eli Whitney', b: 'Eli Whitney'})
    ).toThrow();
  });

  test('findOneValueByParamsThrowing', () => {
    const items = [
      {brand: 'crush', flavor: 'grape'},
      {brand: 'fanta', flavor: 'strawberry'},
      {brand: 'crush', flavor: 'orange'}
    ];
    const params = {brand: 'crush', flavor: 'orange'};
    expect(findOneValueByParamsThrowing(params, items)).toEqual(
      {brand: 'crush', flavor: 'orange'}
    );
    const badParams = {brand: 'crush', flavor: 'pretzel'};
    expect(() => findOneValueByParamsThrowing(badParams, items)).toThrow();
    const tooGoodParams = {brand: 'crush'};
    expect(() => findOneValueByParamsThrowing(tooGoodParams, items)).toThrow();
  });
});

