const Joi = require('joi')
const Sequelize = require('sequelize');
const Path = require('path');
const Hapi = require('hapi');
const Inert = require("inert");
const Vision = require("vision");
const HapiSwagger = require("hapi-swagger");
const port = process.env.PORT || 3000;
const server = new Hapi.Server(
  {
    routes: {
      files: {
        relativeTo: Path.join(__dirname, 'public')
      }
    },
    port
  }
);

(async () => {

  var dev = process.env.POSTGRES_HOST;
  var sequelize;

  if (dev) {
    sequelize = new Sequelize(
      `postgres://${process.env.POSTGRES_HOST}/${process.env.POSTGRES_DB || "heroes"}`,
      {
        ssl: process.env.POSTGRES_SSL,
        dialectOptions: {
          ssl: process.env.POSTGRES_SSL,
        },
      }
    );
  } else {
    sequelize = new Sequelize(process.env.DATABASE_URL);
  }

  await sequelize.authenticate();
  console.log("postgres is running");

  const Hero = sequelize.define("hero", {
    name: Sequelize.STRING,
    power: Sequelize.STRING,
  });

  const Course = sequelize.define("course", {
    name: Sequelize.STRING,
    start: Sequelize.DATEONLY,
    capacity: Sequelize.INTEGER,
  });

  const Request = sequelize.define("request", {
    name: Sequelize.STRING,
    email: Sequelize.STRING,
    phone: Sequelize.STRING,
  });

  const Payment = sequelize.define("payment", {
    amount: Sequelize.INTEGER,
  });

  Course.hasMany(Request);
  Request.hasOne(Payment);

  await Hero.sync({ force: true });
  await Course.sync({ alter: true });
  await Request.sync({ alter: true });
  await Payment.sync({ alter: true });

  await server.register([
    Inert,
    Vision,
    {
      plugin: HapiSwagger,
      options: {
        info: {
          title: "Node.js with Postgres",
          version: "1.0",
        },
      }
    },
  ]);

  server.route([
    {
      method: "GET",
      path: "/course",
      handler: () => {
        return Course.findAll();
      },
      config: {
        description: "List All Courses",
        notes: "Courses from database",
        tags: ["api"],
      },
    },
    {
      method: "GET",
      path: "/course/active",
      handler: () => {
        var courses = Course
          .findAll({
            include: [{
              model: Request,
            }]
          })
          .filter(x => new Date(x.start) > new Date())
          .map(x => {
            x.capacity = x.capacity - x.requests.length;
            return {
              id: x.id,
              name: x.name,
              start: x.start,
              capacity: x.capacity,
              createdAt: x.createdAt,
              updatedAt: x.updatedAt,
            }
          })
          .filter(x => x.capacity > 0);
        return courses;
      },
      config: {
        description: "List All Active Courses",
        notes: "Courses from database",
        tags: ["api"],
      },
    },
    {
      method: "GET",
      path: "/course/admin",
      handler: () => {
        var courses = Course
          .findAll({
            include: [{
              model: Request,
            }]
          });
        return courses;
      },
      config: {
        description: "List All Courses",
        notes: "Courses from database",
        tags: ["api"],
      },
    },
    {
      method: "POST",
      path: "/course",
      config: {
        handler: (req) => {
          const { payload } = req;
          return Course.create(payload);
        },
        description: "Create a Course",
        notes: "create a Course",
        tags: ["api"],
        validate: {
          payload: {
            name: Joi.string().required(),
            start: Joi.date().required(),
            capacity: Joi.number().required(),
          },
        },
      },
    },
    {
      method: "GET",
      path: "/course/{id}/request",
      config: {
        handler: (req) => {
          return Request.findAll({ where: { courseId: req.params.id } });
        },
        validate: {
          params: {
            id: Joi.string().required(),
          },
        },
        description: "List All Requests",
        notes: "Requests from database",
        tags: ["api"],
      },
    },
    {
      method: "POST",
      path: "/course/{id}/request",
      config: {
        handler: (req) => {
          const { payload } = req;
          return Request.create(payload);
        },
        description: "Create a Request",
        notes: "create a Request",
        tags: ["api"],
        validate: {
          payload: {
            courseId: Joi.number().required(),
            name: Joi.string().required(),
            email: Joi.string().required(),
            phone: Joi.string().required(),
          },
        },
      },
    },
    {
      method: "GET",
      path: "/heroes",
      handler: () => {
        return Hero.findAll();
      },
      config: {
        description: "List All heroes",
        notes: "heroes from database",
        tags: ["api"],
      },
    },
    {
      method: "POST",
      path: "/heroes",
      config: {
        handler: (req) => {
          const { payload } = req;
          return Hero.create(payload);
        },
        description: "Create a hero",
        notes: "create a hero",
        tags: ["api"],
        validate: {
          payload: {
            name: Joi.string().required(),
            power: Joi.string().required(),
          },
        },
      },
    },
    {
      method: "DELETE",
      path: "/heroes/{id}",
      config: {
        handler: (req) => {
          return Hero.destroy({ where: { id: req.params.id } });
        },
        description: "Delete a hero",
        notes: "Delete a hero",
        tags: ["api"],
        validate: {
          params: {
            id: Joi.string().required(),
          },
        },
      },
    },
    {
      method: 'GET',
      path: '/{filename}',
      handler: {
        file: function (request) {
          return request.params.filename;
        }
      }
    }
  ]);

  await server.start();
  console.log("server running at", server.info.port);
})();
