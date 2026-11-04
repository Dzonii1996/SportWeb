import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, LogIn } from "lucide-react";
import { API_URL } from "../config";
import { useTranslation } from "react-i18next";

function Login() {
  const { t } = useTranslation();


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
        `${API_URL}/api/auth/login`,
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

        // "storage" se ne okida u istom tabu, pa javljamo NavBar-u ručno
        window.dispatchEvent(new Event("storage"));


        alert(t("login.signedInSuccessfully"));


        navigate("/");


      } else {

        alert(data.message);

      }


    } catch (error) {

      console.log(error);

      alert(t("common.couldNotConnectToThe2"));

    }

  };



  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-600 to-green-800 px-4">


      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">


        <div className="text-center mb-8">

          <h1 className="text-3xl font-bold text-gray-800">
           {t("login.welcome")}
          </h1>


          <p className="text-gray-500 mt-2">
           {t("login.signInToYourAccount")}
          </p>

        </div>



        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >



          {/* Email */}

          <div>

            <label className="block text-gray-700 mb-2">
             {t("common.email")}
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

                placeholder={t("common.enterYourEmail")}

                className="w-full p-3 outline-none"

              />


            </div>

          </div>





          {/* Lozinka */}

          <div>


            <label className="block text-gray-700 mb-2">
             {t("common.password")}
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

                placeholder={t("login.enterYourPassword")}

                className="w-full p-3 outline-none"

              />


            </div>

            <div className="text-right mt-2">
              <Link
                to="/forgot-password"
                className="text-sm text-green-700 hover:underline"
              >
               {t("login.forgotYourPassword")}
              </Link>
            </div>


          </div>





          {/* Dugme */}

          <button

            type="submit"

            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition"

          >

            <LogIn size={20} />

          {t("common.signIn")}

          </button>



        </form>





        <div className="text-center mt-6">


          <p className="text-gray-600">

          {t("login.dontHaveAnAccount")}
          </p>



          <Link

            to="/register"

            className="text-green-600 font-semibold hover:underline"

          >

          {t("login.signUp")}

          </Link>


        </div>



      </div>


    </div>
  );
}


export default Login;