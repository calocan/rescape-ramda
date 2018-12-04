/**
 * Created by Andy Likuski on 2018.05.10
 * Copyright (c) 2018 Andy Likuski
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import {apply} from 'folktale/fantasy-land';
import {task as folktask, of, fromPromised} from 'folktale/concurrency/task';
import {
  defaultRunConfig, lift1stOf2ForMDeepMonad, objOfMLevelDeepListOfMonadsToListWithPairs,
  objOfMLevelDeepMonadsToListWithPairs, pairsOfMLevelDeepListOfMonadsToListWithPairs,
  promiseToTask,
  resultToTask,
  taskToPromise,
  defaultRunToResultConfig,
  traverseReduce,
  traverseReduceWhile,
  traverseReduceDeep
} from './monadHelpers';
import * as R from 'ramda';
import * as Result from 'folktale/result';
import * as Maybe from 'folktale/maybe';
import * as f from './functions';


describe('monadHelpers', () => {
  test('Should convert Task to Promise', async () => {
    await expect(taskToPromise(folktask(
      resolver => resolver.resolve('donut')
    ))).resolves.toBe('donut');
    const err = new Error('octopus');
    await expect(taskToPromise(folktask(resolver => resolver.reject(err)))).rejects.toBe(err);
  });

  test('Should convert Promise to Task', async () => {
    await expect(taskToPromise(promiseToTask(new Promise(function (resolve, reject) {
      resolve('donut');
    })))).resolves.toBe('donut');
    const err = new Error('octopus');
    await expect(taskToPromise(promiseToTask(new Promise(function (resolve, reject) {
      reject(err);
    }), true))).rejects.toBe(err);
    // What if a chained task rejects
    await expect(taskToPromise(R.composeK(
      value => folktask(resolver => resolver.reject('2 2 1 1 2')),
      value => folktask(resolver => resolver.reject('1 1 1 race')),
      value => folktask(resolver => resolver.reject('was 1 2')),
      value => of('was a race horse')
    )('1 1'))).rejects.toEqual('was 1 2');
  });

  test('defaultRunConfig Resolved', done => {
    folktask(resolver => resolver.resolve('Re solved!')).run().listen(
      defaultRunConfig({
        onResolved: resolve => {
          expect(resolve).toEqual('Re solved!');
          done();
        }
      })
    );
  });

  test('defaultRunConfig Throws', () => {
    expect(
      () => folktask(resolver => {
        throw new Error('Oh noo!!!');
      }).run().listen(
        defaultRunConfig({
          onResolved: resolve => {
            throw ('Should not have resolved!'); // eslint-disable-line no-throw-literal
          }
        })
      )
    ).toThrow();
  });

  test('defaultRunToResultConfig Resolved', done => {
    folktask(resolver => resolver.resolve(Result.Ok('Re solved!'))).run().listen(
      defaultRunToResultConfig({
        onResolved: resolve => {
          expect(resolve).toEqual('Re solved!');
          done();
        }
      })
    );
  });

  test('defaultRunResultConfig Throws', () => {
    expect(
      () => folktask(resolver => {
        // Result.Error should result in onRejected being called, which throws
        resolver.resolve(Result.Error('Oh noo!!!'));
      }).run().listen(
        defaultRunToResultConfig({
          onResolved: resolve => {
            throw ('Should not have resolved!'); // eslint-disable-line no-throw-literal
          }
        })
      )
    ).toThrow();
  });

  test('composeK with new Tasks (technology test)', done => {
    R.composeK(
      v => of(`${v} racehorse`),
      v => of(`${v} a`),
      v => of(`${v} was`),
      v => of(`${v} 1`)
    )(1).run().listen({
      onRejected: reject => {
        throw(reject);
      },
      onResolved: result => {
        expect(result).toEqual(
          '1 1 was a racehorse'
        );
        done();
      }
    });
  });

  test('composeK with new Tasks and error (technology test)', done => {
    R.composeK(
      v => of('I never get called :<'),
      v => folktask(resolver => resolver.reject(`${v} Oh no!`)),
      v => of(`${v} a`),
      v => of(`${v} was`),
      v => of(`${v} 1`)
    )(1).run().listen({
      onRejected: reject => {
        expect(reject).toEqual(
          '1 1 was a Oh no!'
        );
        done();
      },
      onResolved: result => {
        throw(new Error(result));
      }
    });
  });

  test('fromPromised (technology test)', done => {
    // fromPromised works on an n-arity function that returns a promise
    const task = fromPromised(receive => Promise.resolve(`shellac${receive}`))('ing');
    task.run().listen({
      onRejected: reject => {
        throw(reject);
      },
      onResolved: result => {
        expect(result).toEqual(
          'shellacing'
        );
        done();
      }
    });
  });

  test('resultToTask', done => {
    resultToTask(Result.Ok(1)).run().listen(defaultRunConfig(
      {
        onResolved: response => {
          expect(response).toEqual(1);
          done();
        }
      }
    ));
  });
  test('resultToTaskError', done => {
    resultToTask(Result.Error(1)).run().listen({
      onRejected: response => {
        expect(response).toEqual(1);
        done();
      }
    });
  });


  const merge = (res, [k, v]) => R.merge(res, {[k]: v});
  const initialValue = apConstructor => apConstructor({});

  // Convert dict into list of Container([k,v]) because ramda's reduce doesn't support non-lists
  const objOfApplicativesToApplicative = R.curry((apConstructor, objOfApplicatives) => f.mapObjToValues(
    (v, k) => {
      return v.chain(val => apConstructor([k, val]));
    },
    objOfApplicatives
  ));

  test('traverseReduce', (done) => {
    const initialResult = initialValue(Result.of);

    expect(
      traverseReduce(
        merge,
        initialResult,
        objOfApplicativesToApplicative(Result.of, {a: Result.of('a'), b: Result.of('b')})
      )
    ).toEqual(
      Result.of({a: 'a', b: 'b'})
    );

    const mapper = objOfApplicativesToApplicative(of);
    const initialTask = initialValue(of);
    // More complicated
    const task = R.composeK(
      // returns a single Task
      letterToApplicative => traverseReduce(merge, initialTask, mapper(letterToApplicative)),
      values =>
        // wrap in task of to support composeK
        of(
          R.map(
            // First reduce each letter value to get
            //  {
            //  a: Task({apple: Result.of('apple'), aardvark: Result.of('aardvark')}),
            //  b: Task({banana: Result.of('banana'), bonobo: Result.of('bonobo')})
            //  }
            v => traverseReduce(
              merge,
              initialTask,
              mapper(v)
            ),
            values
          )
        )
    )(
      {
        a: {apple: of('apple'), aardvark: of('aardvark')},
        b: {banana: of('banana'), bonobo: of('bonobo')}
      }
    );
    task.run().listen({
      onRejected: reject => {
        throw(reject);
      },
      onResolved: result => {
        expect(result).toEqual({
          a: {apple: 'apple', aardvark: 'aardvark'},
          b: {banana: 'banana', bonobo: 'bonobo'}
        });
        done();
      }
    });
  });


  test('traverseReduceDeep', () => {
    const level2Constructor = R.compose(Result.Ok, Maybe.Just);

    expect(
      traverseReduceDeep(
        2,
        R.add,
        level2Constructor(0),
        R.map(level2Constructor, [1, 2, 3])
      )
    ).toEqual(
      Result.of(Maybe.Just(6))
    );

    const level3Constructor = R.compose(Result.Ok, Maybe.Just, Array.of);

    expect(
      traverseReduceDeep(
        3,
        R.divide,
        level3Constructor(1000),
        [
          // We ap R.divide(1000) with this container, meaning we call R.map(R.divide(2), [10,100,1000])
          // this yields the reduction [100, 10, 1]
          level3Constructor(10, 100, 1000),
          // Now this iteration results in the operation
          // R.ap([R.divide(10), R.multiply(100), R.multiply(1000)], [1, 2, 4]);
          // Ramda's ap function applies [1, 2, 4] to each function
          // to yield [100 / 1, 100 / 2, 100 / 4, 10 / 1, 10 / 2, 10 / 4, 1 / 1, 1 / 2, 1 / 4]
          level3Constructor(1, 2, 4)
        ]
      )
    ).toEqual(
      Result.of(Maybe.Just([100 / 1, 100 / 2, 100 / 4, 10 / 1, 10 / 2, 10 / 4, 1 / 1, 1 / 2, 1 / 4]))
    );

    // Operating on a 3 deep container at level 2
    // Even though our container is like above, we only lift twice so we can concat the two arrays
    // We aren't lifting to operate on each array item
    expect(
      traverseReduceDeep(
        2,
        R.concat,
        level3Constructor(),
        [
          level3Constructor(10, 100, 1000),
          level3Constructor(1, 2, 4)
        ]
      )
    ).toEqual(
      Result.of(Maybe.Just([10, 100, 1000, 1, 2, 4]))
    );
  });

  test('traverseReduceTaskWhile', done => {
    const initialTask = initialValue(of);
    const task = traverseReduceWhile(
      // Make sure we accumulate up to b but don't run c
      {
        predicate: (accumulated, applicative) => R.not(R.equals('b', applicative[0])),
        accumulateAfterPredicateFail: true
      },
      merge,
      initialTask,
      objOfApplicativesToApplicative(of, {
        a: of('a'), b: of('b'), c: of('c').map(() => {
          throw new Error('This task should not run!');
        })
      })
    );
    task.run().listen({
      onRejected: reject => {
        throw(reject);
      },
      onResolved: result => {
        expect(result).toEqual({a: 'a', b: 'b'});
        done();
      }
    });
  });


  test('traverseReduceResultWhile', done => {
    const initialResult = initialValue(Result.of);
    traverseReduceWhile(
      // Predicate should be false when we have a b accumulated
      (accumulated, applicative) => R.not(R.prop('b', accumulated)),
      merge,
      initialResult,
      objOfApplicativesToApplicative(Result.of, {a: Result.of('a'), b: Result.of('b'), c: Result.of('c')})
    ).map(result => {
        expect(result).toEqual({a: 'a', b: 'b'});
        done();
      }
    );
  });


  test('lift1stOf2ForMDeepMonad', () => {
    // a -> Result a
    const resultConstructor = Result.Ok;
    // This is what lift2For1DeepMonad is doing:
    // To apply a 1-level monad to the same type of 1-level monad
    const lifterFor1LevelDeep = R.liftN(2, R.add)(resultConstructor(5));
    // f -> Result (Just (a) ) -> Result (Just (f (a)))
    expect(lifterFor1LevelDeep(resultConstructor(1))).toEqual(resultConstructor(6));

    // Now use lift1stOf2ForMDeepMonad
    // f -> Result (Just (a) ) -> Result (Just (f (a)))
    const myLittleResulAdder = lift1stOf2ForMDeepMonad(1, resultConstructor, R.add);
    expect(myLittleResulAdder(5)(resultConstructor(1))).toEqual(resultConstructor(6));
    expect(myLittleResulAdder(6)(resultConstructor(1))).toEqual(resultConstructor(7));

    // a -> Result (Just a)
    const resultOfMaybeConstructor = R.compose(Result.Ok, Maybe.Just);

    // This is what lift2For2DeepMonad is doing:
    // To apply an 2-level monad to the same type of 2-level monad, we must lift twice
    // This performs to maps of the monad to get at the underlying value
    // Result (Just (a)) -> Result (Just b)
    const lifterFor2LevelDeep = R.liftN(2, R.liftN(2, R.add))(resultOfMaybeConstructor(5));
    // f -> Result (Just (a) ) -> Result (Just (f (a)))
    expect(lifterFor2LevelDeep(resultOfMaybeConstructor(1))).toEqual(resultOfMaybeConstructor(6));

    // Now use lift1stOf2ForMDeepMonad
    // f -> Result (Just (a) ) -> Result (Just (f (a)))
    const myLittleResultWithMaybeAdder = lift1stOf2ForMDeepMonad(2, resultOfMaybeConstructor, R.add);
    expect(myLittleResultWithMaybeAdder(5)(resultOfMaybeConstructor(1))).toEqual(resultOfMaybeConstructor(6));
    expect(myLittleResultWithMaybeAdder(6)(resultOfMaybeConstructor(1))).toEqual(resultOfMaybeConstructor(7));
  });

  test('lift1stOf2ForMDeepMonadWithLists', () => {
    // [a] -> Just [[a]]
    // We have to wrap the incoming array so that we apply concat to two 2D arrays
    // Otherwise when we step into the 2nd monad, and array, we'll be mapping over individual elements, as below
    const maybeOfListConstructor = R.compose(Maybe.Just, a => [a]);
    // Now use lift1stOf2ForMDeepMonad
    // f -> (Just [a]) -> Just (f (a))
    const myLittleMaybeListConcatter = lift1stOf2ForMDeepMonad(2, maybeOfListConstructor, R.concat);
    expect(myLittleMaybeListConcatter(['a'])(
      maybeOfListConstructor(['b', 'c', 'd'])
    )).toEqual(maybeOfListConstructor(['a', 'b', 'c', 'd']));

    // The same as above, but just operating on Just, so we don't need to wrap the array
    const maybeOfListConstructor1D = R.compose(Maybe.Just, a => a);
    // Now use lift1stOf2ForMDeepMonad
    // f -> (Just [a]) -> Just (f (a))
    const myLittleMaybeListConcatter1D = lift1stOf2ForMDeepMonad(1, maybeOfListConstructor1D, R.concat);
    expect(myLittleMaybeListConcatter1D(['a'])(
      maybeOfListConstructor1D(['b', 'c', 'd'])
    )).toEqual(maybeOfListConstructor1D(['a', 'b', 'c', 'd']));

    // [a] -> Just [a]
    // In this case we want to operate on each item of the incoming array
    const maybeOfItemsConstructor = R.compose(Maybe.Just, a => a);
    // Now use lift1stOf2ForMDeepMonad
    // f -> (Just [a]) -> Result (Just (f (a)))
    const myLittleMaybeItemsAppender = lift1stOf2ForMDeepMonad(2, maybeOfItemsConstructor, R.concat);
    expect(myLittleMaybeItemsAppender('a')(maybeOfItemsConstructor(['b', 'c', 'd']))).toEqual(maybeOfItemsConstructor(['ab', 'ac', 'ad']));

    // [a] -> [Just a]
    // We have to wrap the incoming array so that we apply functions to the internal array instead of each individual
    // item of the array
    const listOfMaybeConstructor = R.compose(x => [x], Maybe.Just);

    // f -> [Just a] -> (Just (f (a)))
    const listOfMaybeAppender = lift1stOf2ForMDeepMonad(2, listOfMaybeConstructor, R.concat);
    const listOfMaybes = R.chain(listOfMaybeConstructor, ['b', 'c', 'd']);

    expect(listOfMaybeAppender('a')(listOfMaybes)).toEqual(
      R.chain(listOfMaybeConstructor, ['ab', 'ac', 'ad'])
    );
  });

  test('objOfMLevelDeepMonadsToListWithPairs', () => {
    expect(objOfMLevelDeepMonadsToListWithPairs(
      1,
      Result.Ok,
      {a: Result.Ok(1), b: Result.Ok(2)})
    ).toEqual(
      [Result.Ok(['a', 1]), Result.Ok(['b', 2])]
    );

    expect(objOfMLevelDeepMonadsToListWithPairs(
      2,
      R.compose(Result.Ok, Maybe.Just),
      {a: Result.Ok(Maybe.Just(1)), b: Result.Ok(Maybe.Just(2))})
    ).toEqual(
      [Result.Ok(Maybe.Just(['a', 1])), Result.Ok(Maybe.Just(['b', 2]))]
    );
  });

  test('objOfMLevelDeepListOfMonadsToListWithPairs', () => {
    const level1Constructor = R.compose(Maybe.Just);
    // Map each array item to the constructor
    const objOfLevel1Monads = R.map(R.map(level1Constructor), {b: [1, 2], c: [3, 4], d: [4, 5]});

    expect(objOfMLevelDeepListOfMonadsToListWithPairs(1, level1Constructor, objOfLevel1Monads)).toEqual(
      R.map(level1Constructor, [['b', [1, 2]], ['c', [3, 4]], ['d', [4, 5]]])
    );

    const level2Constructor = R.compose(Result.Ok, Maybe.Just);
    const objOfLevel2Monads = R.map(R.map(level2Constructor), {b: [1, 2], c: [3, 4], d: [4, 5]});

    expect(objOfMLevelDeepListOfMonadsToListWithPairs(2, level2Constructor, objOfLevel2Monads)).toEqual(
      R.map(level2Constructor, [['b', [1, 2]], ['c', [3, 4]], ['d', [4, 5]]])
    );
  });

  test('pairsOfMLevelDeepListOfMonadsToListWithPairs', () => {
    const level1Constructor = R.compose(Maybe.Just);
    const pairsOfLevel1Monads = [
      ['b', R.map(level1Constructor, [1, 2])],
      ['c', R.map(level1Constructor, [3, 4])],
      ['d', R.map(level1Constructor, [4, 5])]
    ];

    // Note that I pass 2 here to indicate that the monad is two levels A Maybe containing an array
    // It's always confusing treating a list as monad because Array.of expects a list, which makes
    // it hard to think about
    expect(pairsOfMLevelDeepListOfMonadsToListWithPairs(1, level1Constructor, pairsOfLevel1Monads)).toEqual(
      R.map(level1Constructor, [['b', [1, 2]], ['c', [3, 4]], ['d', [4, 5]]])
    );

    const level2Constructor = R.compose(Result.Ok, Maybe.Just);
    const pairsOfLevel2Monads = [
      ['b', R.map(level2Constructor, [1, 2])],
      ['c', R.map(level2Constructor, [3, 4])],
      ['d', R.map(level2Constructor, [4, 5])]
    ];

    expect(pairsOfMLevelDeepListOfMonadsToListWithPairs(2, level2Constructor, pairsOfLevel2Monads)).toEqual(
      R.map(level2Constructor, [['b', [1, 2]], ['c', [3, 4]], ['d', [4, 5]]])
    );
  });

  test('Technology test: chaining', () => {
    // Map a Result an map a Maybe
    expect(
      R.map(
        maybe => R.map(v => 2, maybe),
        Result.Ok(Maybe.Just(1))
      )
    ).toEqual(Result.Ok(Maybe.Just(2)));

    // Chain a Result
    expect(
      R.chain(
        maybe => Result.Ok(Maybe.Just(2)),
        Result.Ok(Maybe.Just(1))
      )
    ).toEqual(Result.Ok(Maybe.Just(2)));

    // Chain a Result an map a Maybe
    expect(
      R.chain(
        maybe => Result.Ok(R.map(v => 2, maybe)),
        Result.Ok(Maybe.Just(1))
      )
    ).toEqual(Result.Ok(Maybe.Just(2)));

    // Chain a Result and Chain a Maybe
    expect(
      R.chain(
        maybe => Result.Ok(R.chain(v => Maybe.Just(2), maybe)),
        Result.Ok(Maybe.Just(1))
      )
    ).toEqual(Result.Ok(Maybe.Just(2)));


    // Map a Result and Chain a Maybe
    expect(
      R.map(
        maybe => R.chain(v => Maybe.Just(2), maybe),
        Result.Ok(Maybe.Just(1))
      )
    ).toEqual(Result.Ok(Maybe.Just(2)));
  });

  test('Lifting monads that include lists', () => {
    // Now play with lists. If we could apply lists it would look like this
    // List.of(R.add).ap([1, 2]).ap(10, 11), meaning map [1, 2] with R.add and then map [10, 11] to the results of that
    // Because we are operating within the container of a list the four resulting values are in one single list
    // It works using R.lift
    // This First applies add to [1, 2], literally meaning we call R.map(R.add, [1, 2]), yielding
    // two partials as a func: x => [R.add(1), R.add(2)]. Next we apply the partials to [10, 11], literally meaning we call
    // R.map(x => [R.add(1), R.add(2)], [10, 11]), yielding [11, 12, 12, 13]
    // The important thing to note is that R.add operates on each item of the list because each of the first list is mapped to
    // the R.add to get partials and then each of the second list is mapped to that to each partial
    // The reason the list is flat is because R.liftN detects arrays and does an array reduce,
    // just as it does other reductions to combine other monad types, like Tasks
    expect(R.liftN(2, R.add)([1, 2], [10, 11])).toEqual([11, 12, 12, 13]);

    // Now combine lists with Result. Since we receive an array there's nothing to do to contain it,
    // I'm leaving R.identity here to display my confusion. There is no Array.of and the incoming value is an array
    const resultListConstructor = R.compose(Result.Ok, R.identity);
    // This should add the each item from each array
    const myLittleResultWithListConcatter = lift1stOf2ForMDeepMonad(2, resultListConstructor, R.add);
    expect(myLittleResultWithListConcatter([1, 2])(resultListConstructor([10, 11]))).toEqual(resultListConstructor([11, 12, 12, 13]));
  });

  test('Lifting objects with monads', () => {
    // Processing objects with monads
    const resultMaybeConstructor = R.compose(Result.Ok, Maybe.Just);
    const myObject = {a: resultMaybeConstructor(1), b: resultMaybeConstructor(2)};
    const liftKeyIntoMonad = lift1stOf2ForMDeepMonad(2, resultMaybeConstructor, (k, v) => [[k, v]]);
    // We can map each to put the keys into the monad, converting the k, v to an array with one pair
    // Object <k, (Result (Maybe v))> -> [Result (Maybe [[k, v]]) ]
    const listOfResultOfMaybeOfListOfOnePair = R.map(
      ([k, v]) => liftKeyIntoMonad(k, v),
      R.toPairs(myObject)
    );
    expect(listOfResultOfMaybeOfListOfOnePair).toEqual(
      [resultMaybeConstructor([['a', 1]]), resultMaybeConstructor([['b', 2]])]
    );
    // Now let's make a single Result. We use traverseReduce so we can call a reduction function
    // that combines the underlying values. I still don't know if ramda has a version of this
    // [Result (Maybe [[k, v]]) ] -> Result (Maybe [[k, v], [k, v]...])
    const resultOfMaybeOfListOfPairs = traverseReduce(
      (a, b) => R.concat(a, b),
      resultMaybeConstructor([]), // Initial value is an empty array. We'll concat arrays of single pairs to it
      listOfResultOfMaybeOfListOfOnePair
    );
    expect(resultOfMaybeOfListOfPairs).toEqual(resultMaybeConstructor([['a', 1], ['b', 2]]));
  });
});

