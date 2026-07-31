const pool = require("../database/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const register = async (req, res) => {

  try {

    const { name, email, password } = req.body;


    // Provera podataka
    if (!name || !email || !password) {

      return res.status(400).json({
        success: false,
        message: "Sva polja su obavezna."
      });

    }


    // Provera da li email postoji

    const existingUser = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );


    if (existingUser.rows.length > 0) {

      return res.status(400).json({
        success: false,
        message: "Email već postoji."
      });

    }


    // Enkripcija lozinke

    const hashedPassword = await bcrypt.hash(password, 10);



    // Upis u bazu

    const newUser = await pool.query(

      `INSERT INTO users (name, email, password)
       VALUES ($1, $2, $3)
       RETURNING id, name, email`,

      [
        name,
        email,
        hashedPassword
      ]

    );



    res.status(201).json({

      success: true,

      message: "Korisnik uspešno registrovan.",

      user: newUser.rows[0]

    });



  } catch (error) {

    console.log(error);

    res.status(500).json({

      success: false,

      message: "Greška na serveru."

    });

  }

};


const login = async (req, res) => {

  try {

    const { email, password } = req.body;


    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );


    if (result.rows.length === 0) {

      return res.status(400).json({
        success: false,
        message: "Korisnik ne postoji."
      });

    }


    const user = result.rows[0];


    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );


    if (!passwordMatch) {

      return res.status(400).json({
        success: false,
        message: "Pogrešna lozinka."
      });

    }


    const token = jwt.sign(
      {
        id: user.id,
        email: user.email
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d"
      }
    );


    res.json({
      success: true,
      message: "Uspešna prijava.",
      token,
      user:{
        id:user.id,
        name:user.name,
        email:user.email
      }
    });


  } catch(error){

    console.log(error);

    res.status(500).json({
      success:false,
      message:"Greška servera"
    });

  }

};



module.exports = {
  register,
  login
};