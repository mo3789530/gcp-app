import express from 'express';
import * as service from '../services/gcp';


const router = express.Router();

/**
 * Call from Cloud Scheduler
 * Clear expired condition from GCP IAM
 */
router.post("/api/clear", (req, res) => {
  (async () => {
    const auth = await service.login();
    await service.clearPolicy(auth);
    return res.status(200);
  })().catch((e) => {
    console.log(e);
    res.status(400).json({ err: e });
  });
});

/**
 * Request from GCP operator when deploy or any maintenance
 * 2.MSteamsに通知
 * @param {string} email email (this email is required to registered on GCP )
 * @param {string} text request reason
 * @param {string} time access limt
 * {
 *  "email": string,
 *  "text": string,
 *  "project": string,
 *  "role": string,
 *  "time": string
 * }
 */
router.post("/api/condition", (req, res) => {
  (async () => {
    const auth = await service.login();
    const project = req.body.project;
    const role = req.body.role;
    await service.setCondition(Number(req.body.time), req.body.email, role, project, auth);

    res
      .status(200)
      .json({ link: `https://console.cloud.google.com/home/dashboard?project=${project}` });
  })().catch((e) => {
    console.log(e);
    res.status(400).json({ err: e.toString() });
  });
});

router.post('/api/logout', (req, res) => {
  (async () => {
    const auth = await service.login();
    const email = req.body.email;
    const project = req.body.project
    await service.logout(email, project, auth);
    res.status(200);
  })().catch((e) => {
    console.error(e);
    res.status(400).json({ err: e.toString() });
  })
});

router.get('/api/status', (req, res) => {
  (async () => {
    // const auth = await service.login();
    // const status = await service.getStatus(auth);
    const status = [
      {
        email: 'mo3789530@gmail.com',
        role: 'roles/accesscontextmanager.policyEditor',
        condition: {
          expression: 'request.time < timestamp("2022-02-08T15:00:00.000Z")',
          title: 'test'
        }
      },
      {
        email: 'mo3789530@gmail.com',
        role: 'roles/owner',
        condition: undefined
      }
    ];
    res.status(200).json(status);
  })().catch((e) => {
    console.error(e);
    res.status(400).json({ err: e.toString() });
  })
});

router.get('/api/projects', (req, res) => {
  res.status(200).json(service.getProjects());
});

/**
 * Request from browser when user request to access
 */
router.get("", (req, res) => {
  res.render("gcp", { title: "GCP", projects: service.getProjects() });
});

router.get("/status/users", (req, res) => {
  (async () => {
    // await service.login();
    // const status = await service.getStatus();
    const status = [
      {
        email: 'mo3789530@gmail.com',
        role: 'roles/accesscontextmanager.policyEditor',
        condition: {
          expression: 'request.time < timestamp("2022-02-08T15:00:00.000Z")',
          title: 'test'
        }
      },
      {
        email: 'mo3789530@gmail.com',
        role: 'roles/owner',
        condition: undefined
      }
    ];
    res.render("users", {status: status});
  })().catch((e) => {
    console.error(e);
    res.status(400).json({ err: e.toString() });
  })
});

// test
router.get("/api/health", (req, res) => {
  res.json({ message: "Hello World!" });
});

export default router;