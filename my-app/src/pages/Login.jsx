import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, LogIn } from "lucide-react";

function Login() {

  const navigate = useNavigate();


  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });


  const handleChange = (e) => {

    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });

  };


  const handleSubmit = async (e) => {

    e.preventDefault();


    try {

      const response = await fetch(
        "http://localhost:5000/api/auth/login",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify(formData),
        }
      );


      const data = await response.json();


      if (data.success) {

        localStorage.setItem(
          "token",
          data.token
        );


        localStorage.setItem(
          "user",
          JSON.stringify(data.user)
        );


        alert("Uspešna prijava!");


        navigate("/");


      } else {

        alert(data.message);

      }


    } catch (error) {

      console.log(error);

      alert("Greška pri povezivanju sa serverom");

    }

  };



  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-600 to-green-800 px-4">


      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">


        <div className="text-center mb-8">

          <h1 className="text-3xl font-bold text-gray-800">
            Dobrodošli 👋
          </h1>


          <p className="text-gray-500 mt-2">
            Prijavite se na svoj nalog
          </p>

        </div>



        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >



          {/* Email */}

          <div>

            <label className="block text-gray-700 mb-2">
              Email
            </label>


            <div className="flex items-center border rounded-xl px-3">


              <Mail
                className="text-gray-400"
                size={20}
              />


              <input

                name="email"

                value={formData.email}

                onChange={handleChange}

                type="email"

                placeholder="Unesite email"

                className="w-full p-3 outline-none"

              />


            </div>

          </div>





          {/* Lozinka */}

          <div>


            <label className="block text-gray-700 mb-2">
              Lozinka
            </label>


            <div className="flex items-center border rounded-xl px-3">


              <Lock
                className="text-gray-400"
                size={20}
              />


              <input

                name="password"

                value={formData.password}

                onChange={handleChange}

                type="password"

                placeholder="Unesite lozinku"

                className="w-full p-3 outline-none"

              />


            </div>


          </div>





          {/* Dugme */}

          <button

            type="submit"

            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition"

          >

            <LogIn size={20} />

            Prijavi se


          </button>



        </form>





        <div className="text-center mt-6">


          <p className="text-gray-600">

            Nemate nalog?

          </p>



          <Link

            to="/register"

            className="text-green-600 font-semibold hover:underline"

          >

            Registrujte se


          </Link>


        </div>



      </div>


    </div>
  );
}


export default Login;