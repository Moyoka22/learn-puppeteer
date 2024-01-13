/*
 * Resources
 *
 * https://devdocs.io/puppeteer/
 */
import * as path from "node:path";
import * as sqlite from "sqlite3";
import * as AP from "fp-ts/Apply";
import * as O from "fp-ts/Option";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import { constVoid, pipe } from "fp-ts/function";
import * as puppeteer from "puppeteer";

const log = (...args: any[]) => console.log(...args);
const error = (...args: any[]) => console.error(...args);
const ddl =
  "create table if not exists products (uuid uuid primary key, title text not null, price numeric(10,5), creationdatetime not null default current_timestamp)";

sqlite.verbose();
const db = new sqlite.Database(
  path.join(path.dirname(path.resolve(__filename)), "products.db")
);
db.run(ddl);

const main = async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    /*
     * Can be used to set headless mode (browser will run without visible window)
     * New headless mode is an implementeation of headless mode which is part of
     * the normal (headful) chrome browser as opposed to the original headless
     * implementation which was a separate project.
     * More info: https://developer.chrome.com/docs/chromium/new-headless
     */
    defaultViewport: null, // Setting to null sets the maximum viewport
    userDataDir: "./tmp", // Persists data between sessions to prevent resolving of any captchas (TODO - add more notes)
  });
  const page = await browser.newPage();

  let count = 0;
  let url: string | null = "https://www.amazon.com/s?k=iphone";
  while (url !== null) {
    count += 1;
    log(`${count} ${url}`);
    await page.goto(url);

    // .$$ method is a selector
    const productHandles = await page.$$("div[data-uuid].s-result-item");
    await pipe(
      productHandles,
      T.traverseSeqArray((handle: puppeteer.ElementHandle<HTMLDivElement>) =>
        pipe(
          AP.sequenceS(TE.ApplySeq)({
            uuid: pipe(
              TE.tryCatch(
                async () =>
                  await page.evaluate(
                    (el) => el.getAttribute("data-uuid"),
                    /*
                     * page.evaluate can only transfer serializable results.
                     * returning an element results in the element being serialized
                     * as an empty object
                     */
                    handle
                  ),
                error
              ),
              TE.chainOptionK(constVoid)(O.fromNullable)
            ),
            title: pipe(
              TE.tryCatch(
                async () =>
                  await page.evaluate(
                    (el) => el.querySelector("h2 > a > span")?.textContent,
                    /*
                     * page.evaluate can only transfer serializable results.
                     * returning an element results in the element being serialized
                     * as an empty object
                     */
                    handle
                  ),
                error
              ),
              TE.chainOptionK(constVoid)(O.fromNullable)
            ),
            price: pipe(
              TE.tryCatch(
                async () =>
                  await page.evaluate(
                    (el) => el.querySelector(".a-price > span")?.textContent,
                    /*
                     * page.evaluate can only transfer serializable results.
                     * returning an element results in the element being serialized
                     * as an empty object
                     */
                    handle
                  ),
                error
              ),
              TE.chainOptionK(constVoid)(O.fromNullable)
            ),
          }),
          TE.chainEitherK(
            E.tryCatchK(({ uuid, title, price }): void => {
              let _price = price.slice(1);
              db.run(
                "INSERT INTO products (uuid, title, price) VALUES (?, ?, ?) ON CONFLICT(uuid) DO NOTHING;",
                [uuid, title, _price]
              );
            }, constVoid)
          ),
          TE.match(constVoid, constVoid)
        )
      )
    )();
    if ((await page.$(".s-pagination-next.s-pagination-disabled")) !== null) {
      url = null;
    } else {
      const nextBtn = (await page.$(
        "a.s-pagination-next"
      )) as puppeteer.ElementHandle<HTMLAnchorElement> | null;

      url = (await page.evaluate((el) => el?.href, nextBtn)) ?? null;
    }
  }
  await browser.close();
  db.close();
  /* The browser will stay open and the program will keep
   * running if close is not called. All associated pages
   * will be closed */
};

if (require.main === module) main();
