/* eslint-disable @typescript-eslint/no-explicit-any */
import { JSONClient } from "google-auth-library/build/src/auth/googleauth";
import { google, Auth, cloudresourcemanager_v3 } from "googleapis";



export const cloudresourcemanager = google.cloudresourcemanager("v3");

const PROJECT = process.env.PROJECT || "dummy";
const PRODUCTION = process.env.PRODUCTION || "";
const READ_ROLE = process.env.READ_ROLE || "";
const EDIT_ROLE = process.env.EDIT_ROLE || "";
const ADMIN_ROLE = process.env.ADMIN_ROLE || "";

// Login with service account 
export const login = async (): Promise<Auth.GoogleAuth<JSONClient>> => {
  const auth = new google.auth.GoogleAuth({
    scopes: [
      "https://www.googleapis.com/auth/cloud-platform",
    ],
  });
  return auth;
};


// Remove conditions by user
export const logout = async (email: string, project: string, auth: Auth.GoogleAuth) => {
  console.log('logout: ' + email)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const policy: any = await getPolicy(project, auth);
  const bindings = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filteredBindings: any[] = filterBindings(policy.bindings);
  for (const p of filteredBindings) {
    // セットした一時的なロール以外を配列に追加
    if ("condition" in p) {
      const user = 'user:' + email;
      if (p["members"].includes(user)) {
        p['members'] = p['members'].filter((m: any) => {
          return ![user].includes(m);
        });
      }
    }
    bindings.push(p);
  }
  const newPolicy = policy;
  newPolicy.bindings = bindings;
  newPolicy.version = 3;
  try {
    await setPolicy(policy, project, auth);
  } catch (e) {
    console.error(e);
    throw e;
  }
}


// return  
// 
//   [
//     'email' : 'string',
//     'roles': [role: string, condition: Date] 
//   ]
// 
// 
// 
export const getStatus = async (project: string, auth: Auth.GoogleAuth) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const policy: any = await getPolicy(project, auth);
  const member = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const filteredBindings: any[] = filterBindings(policy.bindings);

  for (const p of filteredBindings) {
    for (const m of p.members) {
      const marray = m.split(":");
      // Check service account
      if (marray[0] !== "user") continue;
      if ("condition" in p) {
        // Check expired
        if (isExpire(p["condition"]["expression"])) {
          continue;
        }
        else {
          const user = {
            email: marray[1],
            role: getAbstractRole(p['role']),
            condition: perseExpression(p['condition']['expression'])
          };
          member.push(user)
        }
      }
    }
  }
  return member;
}

// Remove garbage data from GCP IAM
export const clearPolicy = async (auth: Auth.GoogleAuth) => {
  for (const p of projects()) {
    await clear(p, auth);
  }
};


// Set temporary grant with condition to IAM
export const setCondition = async (period: number, account: string, abstractRole: string, project: string, auth: Auth.GoogleAuth) => {
  console.log("set condition");
  const expiry = getExpiry(period);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const policy: any = await getPolicy(project, auth);
  if (verifyUser(account, policy) === false) {
    throw new Error("Email is not register in GCP")
  }
  const role = getRole(abstractRole, project);
  if (role === undefined)
    throw new Error('Role is not found')

  policy.bindings.push({
    condition: {
      expression: `request.time < timestamp("${expiry}")`,
      description: "This is a temporary grant created by GCP DPA",
      title: "granted by GCP DPA",
    },
    members: [`user:${account}`],
    role: role,
  });

  policy.version = 3;
  console.log(policy);

  try {
    await setPolicy(policy, project, auth);
  } catch (e) {
    console.error(e);
    throw e;
  }
};

const projects = () => {
  return getProjects();
}

export const isProduction = (project: string) => {
  const production = PRODUCTION.split(',');
  return production.includes(project);
}

const getAbstractRole = (role: string) => {
  if (READ_ROLE.includes(role)) {
    return 'Read';
  }
  else if (EDIT_ROLE.includes(role)) {
    return 'Edit';
  }
  else if (ADMIN_ROLE.includes(role)) {
    return 'Create';
  }
  return undefined;
}

const getPolicy = async (project: string, auth: Auth.GoogleAuth) => {
  console.log("Get policy");
  try {
    project = `projects/${project}`;
    const res = await cloudresourcemanager.projects.getIamPolicy({
      resource: project,
      requestBody: {
        options: {
          requestedPolicyVersion: 3,
        },
      },
      auth: auth,
    });

    if (res.status === 200) {
      // Validate the response data before returning
      if (res.data && res.data.bindings) {
        return res.data;
      } else {
        throw new Error("Invalid response data: Missing bindings.");
      }
    } else {
      throw new Error(`Failed to fetch IAM policy. Status: ${res.status}`);
    }
  } catch (error) {
    console.error("Error in getPolicy function:", error);
    throw error;
  }
};



const setPolicy = async (policy: cloudresourcemanager_v3.Schema$Policy, project: string, auth: Auth.GoogleAuth) => {
  console.log("Set policy");
  try {
    project = `projects/${project}`;
    const res = await cloudresourcemanager.projects.setIamPolicy({
      resource: project,
      requestBody: {
        policy: policy,
      },
      auth: auth,
    });

    if (res.status === 200) {
      return res;
    } else {
      throw new Error(`Failed to set IAM policy. Status: ${res.status}`);
    }
  }
  catch (error) {
    console.error("Error in setPolicy function:", error);
    throw error;
  }
};



const clear = async (project: string, auth: Auth.GoogleAuth) => {
  console.log("Clear Policy " + project);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const policy: any = await getPolicy(project, auth); // Replace 'any' with an appropriate type if possible
  const filteredBindings: any[] = filterBindings(policy.bindings);

  const newPolicy = { ...policy, bindings: filteredBindings, version: 3 };

  try {
    await setPolicy(newPolicy, project, auth);
  } catch (e) {
    console.error("Error in clear function:", e);
    throw e;
  }
}

const filterBindings = (bindings: any[]): any[] => {
  const filteredBindings: any[] = [];

  for (const binding of bindings) {
    if ("condition" in binding && binding.condition.title.includes("DPA") && isExpire(binding.condition.expression)) {
      console.log("Will delete " + binding.condition);
      continue;
    }
    filteredBindings.push(binding);
  }

  return filteredBindings;
}

// check expression is expired or not
const isExpire = (expression: string) => {
  const now = new Date();
  const expire = perseExpression(expression)
  // console.log(expire)
  // console.log(now)
  if (now > expire) return true;
  return false;
};

const perseExpression = (expression: string) => {
  const regExp = /"(([^)]+)")/;
  const matches = regExp.exec(expression);
  if (matches)
    return new Date(matches[2]);
  else throw Error();
}

// return now + user request time
// Time zone is UTC
// Date format is "'2022-01-06T00:50:00.244Z'"
const getExpiry = (hours: number) => {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date.toISOString();
};

// Verify if email is registered in GCP
const verifyUser = (email: string, policy: any) => {
  for (const p of policy.bindings) {
    for (const m of p.members) {
      const marray = m.split(":");
      // Do not check service account
      if (marray[0] !== "user") continue;
      if (marray[1] === email) {
        return true;
      }
    }
  }
  console.warn("Not found " + email);
  return false;
};

const getRole = (abstractRole: string, project: string) => {
  let roles = [];
  if (abstractRole === 'read') {
    roles = READ_ROLE.split(',');
  } else if (abstractRole === 'edit') {
    roles = EDIT_ROLE.split(',');
  } else {
    roles = ADMIN_ROLE.split(',');
  }
  return findRole(roles, project);

}

const findRole = (roles: string[], project: string) => {
  for (const r of roles) {
    if (r.split('/')[1] === project) {
      return r;
    }
  }
  return undefined;
}

// Get projects 
export const getProjects = () => {
  return PROJECT.split(',');
}



// // debug
// main = async() => {
//   const auth = await login('digital-pf-dev-210528');
//   // await clearPolicy()
//   // console.log(role2)
//   // const v = verifyUser("mo3789530@gmail", role);
//   // console.log(v)
//   // await setCondition(1, "mo3789530@gmail.com");
//   // const role2 = await getPolicy();
//   // console.log(role2)
//   b = isExpire('request.time < timestamp("2022-02-06T04:35:09.068Z")')
//   console.log(b)

// }

// main()