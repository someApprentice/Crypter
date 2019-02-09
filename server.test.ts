import request from "supertest";
import server from "./server";

describe("API", () => {
  it('should return index page', async (done) => {
    await request(server).get('/').expect(200);

    done();
  });

  afterAll(async () => {
    //Jest has detected the following 1 open handle potentially keeping Jest from exiting:
    // > 60 | server.listen(PORT, () => {
    //      |        ^
    //   61 |   console.log(`Node server listening on http://localhost:${PORT}`);
    //   62 | });
    // at Function.listen (node_modules/express/lib/application.js:618:24)
    // at Object.<anonymous> (server.ts:60:8)
  })
});