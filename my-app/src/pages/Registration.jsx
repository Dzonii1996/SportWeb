import { useState } from "react";
import { Link } from "react-router-dom";
import { User, Mail, Lock, UserPlus } from "lucide-react";
import { API_URL } from "../config";
import { useTranslation } from "react-i18next";

function Register() {
  const { t } = useTranslation();


  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });


  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };


  const handleSubmit = async (e) => {
    e.preventDefault();


    if (formData.password !== formData.confirmPassword) {
      alert(t("registration.passwordsDoNotMatch"));
      return;
    }


    try {

      const response = await fetch(
        `${API_URL}/api/auth/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            name: formData.name,
            email: formData.email,
            password: formData.password,
          }),
        }
      );


      const data = await response.json();


      alert(data.message);


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
           {t("registration.createAnAccount")}
          </h1>

          <p className="text-gray-500 mt-2">
           {t("registration.signUpAndFindYour")}
          </p>

        </div>


        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >


          {/* Ime */}

          <div>

            <label className="block text-gray-700 mb-2">
             {t("registration.fullName")}
            </label>

            <div className="flex items-center border rounded-xl px-3">

              <User className="text-gray-400" size={20}/>

              <input
                name="name"
                value={formData.name}
                onChange={handleChange}
                type="text"
                placeholder={t("registration.enterYourFullName")}
                className="w-full p-3 outline-none"
              />

            </div>

          </div>


          {/* Email */}

          <div>

            <label className="block text-gray-700 mb-2">
             {t("common.email")}
            </label>

            <div className="flex items-center border rounded-xl px-3">

              <Mail className="text-gray-400" size={20}/>

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

              <Lock className="text-gray-400" size={20}/>

              <input
                name="password"
                value={formData.password}
                onChange={handleChange}
                type="password"
                placeholder={t("registration.atLeast6Characters")}
                minLength={6}
                required
                className="w-full p-3 outline-none"
              />

            </div>

          </div>


          {/* Potvrda */}

          <div>

            <label className="block text-gray-700 mb-2">
             {t("registration.confirmPassword")}
            </label>

            <div className="flex items-center border rounded-xl px-3">

              <Lock className="text-gray-400" size={20}/>

              <input
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                type="password"
                placeholder={t("registration.enterYourPasswordAgain")}
                className="w-full p-3 outline-none"
              />

            </div>

          </div>


          <button
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl flex items-center justify-center gap-2"
          >

            <UserPlus size={20}/>
           {t("registration.signUp")}
          </button>


        </form>


        <div className="text-center mt-6">

          <p className="text-gray-600">
           {t("registration.alreadyHaveAnAccount")}
          </p>

          <Link
            to="/login"
            className="text-green-600 font-semibold hover:underline"
          >
           {t("registration.signIn")}
          </Link>

        </div>


      </div>

    </div>
  );
}

export default Register;