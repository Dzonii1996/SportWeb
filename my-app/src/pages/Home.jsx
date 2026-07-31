import { Link } from "react-router-dom";
import { Trophy, Users, Calendar, MapPin } from "lucide-react";

function Home() {

  return (
    <div className="min-h-screen bg-gray-100">

      {/* Hero */}
      <section className="bg-green-600 text-white py-24 px-6 text-center">

        <h1 className="text-5xl font-bold mb-5">
          Organizuj svoj sledeći termin ⚽
        </h1>

        <p className="text-lg max-w-2xl mx-auto mb-8">
          Pronađi igrače, rezerviši termin i igraj fudbal,
          košarku i druge sportove sa svojom ekipom.
        </p>


        <div className="flex justify-center gap-4 flex-wrap">

          <Link
            to="/matches"
            className="bg-white text-green-700 px-6 py-3 rounded-xl font-bold hover:bg-gray-100"
          >
            Pronađi termin
          </Link>


          <Link
            to="/create-match"
            className="border border-white px-6 py-3 rounded-xl font-bold hover:bg-white hover:text-green-700"
          >
            Kreiraj termin
          </Link>

        </div>

      </section>


      {/* Statistika */}
      <section className="max-w-6xl mx-auto grid md:grid-cols-3 gap-6 p-8">


        <div className="bg-white rounded-2xl shadow p-6 text-center">
          <Trophy className="mx-auto text-green-600 mb-3" size={40}/>

          <h2 className="text-3xl font-bold">
            250+
          </h2>

          <p className="text-gray-500">
            Odigranih termina
          </p>
        </div>


        <div className="bg-white rounded-2xl shadow p-6 text-center">
          <Users className="mx-auto text-green-600 mb-3" size={40}/>

          <h2 className="text-3xl font-bold">
            1000+
          </h2>

          <p className="text-gray-500">
            Igrača
          </p>
        </div>


        <div className="bg-white rounded-2xl shadow p-6 text-center">
          <MapPin className="mx-auto text-green-600 mb-3" size={40}/>

          <h2 className="text-3xl font-bold">
            50+
          </h2>

          <p className="text-gray-500">
            Lokacija
          </p>
        </div>


      </section>


      {/* Sportovi */}
      <section className="max-w-6xl mx-auto p-8">

        <h2 className="text-3xl font-bold text-center mb-8">
          Popularni sportovi
        </h2>


        <div className="grid md:grid-cols-3 gap-6">

          <Link
            to="/matches"
            className="bg-white rounded-2xl shadow p-8 text-center hover:shadow-xl transition"
          >
            <div className="text-5xl mb-3">
              ⚽
            </div>
            <h3 className="text-xl font-bold">
              Fudbal
            </h3>
          </Link>


          <Link
            to="/matches"
            className="bg-white rounded-2xl shadow p-8 text-center hover:shadow-xl transition"
          >
            <div className="text-5xl mb-3">
              🏀
            </div>
            <h3 className="text-xl font-bold">
              Košarka
            </h3>
          </Link>


          <Link
            to="/matches"
            className="bg-white rounded-2xl shadow p-8 text-center hover:shadow-xl transition"
          >
            <div className="text-5xl mb-3">
              🏐
            </div>
            <h3 className="text-xl font-bold">
              Odbojka
            </h3>
          </Link>

        </div>

      </section>

    </div>
  );
}

export default Home;