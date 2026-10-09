import React from 'react';

const ChassisForm: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto bg-white p-4 font-sans">
      <h1 className="text-[#5b8bc6] text-2xl font-bold text-center mb-6">
        Ajouter un châssis au projet
      </h1>

      <div className="flex">
        {/* Main form area */}
        <div className="flex-1">
          {/* Top thick blue bar */}
          <div className="bg-[#5b8bc6] h-8 w-full mb-2"></div>

          <div className="flex flex-col gap-2">
            {/* First section (2 columns) */}
            <div className="flex gap-2">
              <div className="flex-1 flex flex-col gap-2">
                <input
                  type="text"
                  className="border border-[#b4c9e4] h-9 w-full outline-none px-2"
                />
                <input
                  type="text"
                  className="border border-[#b4c9e4] h-9 w-full outline-none px-2"
                />
              </div>
              <div className="flex-1 flex flex-col gap-2">
                <div className="flex">
                  <div className="bg-[#5b8bc6] text-white w-24 flex items-center justify-center text-sm font-semibold h-9">
                    Gamme
                  </div>
                  <input
                    type="text"
                    defaultValue="TPR"
                    className="border border-[#b4c9e4] flex-1 px-2 h-9 text-sm text-[#5b8bc6] font-semibold outline-none"
                  />
                </div>
                <div className="flex">
                  <div className="bg-[#5b8bc6] text-white w-24 flex items-center justify-center text-sm font-semibold h-9">
                    Reference
                  </div>
                  <input
                    type="text"
                    defaultValue="P2V"
                    className="border border-[#b4c9e4] flex-1 px-2 h-9 text-sm text-[#5b8bc6] font-semibold outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Middle full width input */}
            <input
              type="text"
              defaultValue="onteux"
              className="border border-[#b4c9e4] h-9 px-2 w-full text-[#5b8bc6] text-sm outline-none"
            />

            {/* Bottom row (4 columns) */}
            <div className="flex gap-2">
              <input
                type="text"
                className="border border-[#b4c9e4] h-9 w-24 px-2 outline-none"
              />

              <div className="flex flex-1">
                <div className="bg-[#5b8bc6] text-white w-20 flex items-center justify-center text-sm font-semibold h-9">
                  Haut
                </div>
                <input
                  type="text"
                  defaultValue="1500"
                  className="border border-[#b4c9e4] flex-1 px-2 h-9 text-sm text-[#5b8bc6] font-semibold outline-none"
                />
              </div>

              <div className="flex flex-1">
                <div className="bg-[#5b8bc6] text-white w-24 flex items-center justify-center text-sm font-semibold h-9">
                  Quantité
                </div>
                <input
                  type="text"
                  defaultValue="1"
                  className="border border-[#b4c9e4] flex-1 px-2 h-9 text-sm text-[#5b8bc6] font-semibold outline-none"
                />
              </div>

              <div className="flex flex-1">
                <div className="bg-[#5b8bc6] text-white w-24 flex items-center justify-center text-sm font-semibold h-9">
                  Couleur
                </div>
                <select className="border border-[#b4c9e4] flex-1 px-2 h-9 text-sm text-gray-600 font-semibold outline-none bg-white">
                  <option>Blanc</option>
                </select>
              </div>
            </div>
          </div>

          {/* Options avancées bar */}
          <div className="bg-[#5b8bc6] text-white flex items-center justify-center h-8 mt-2 text-sm font-semibold cursor-pointer">
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
              />
            </svg>
            Options avancées
          </div>
        </div>

        {/* Right side blank area to simulate the full original layout */}
        <div className="w-16 ml-2 flex flex-col">
          <div className="bg-[#5b8bc6] h-8 w-full mb-2"></div>
          <div className="border border-[#b4c9e4] flex-1"></div>
        </div>
      </div>
    </div>
  );
};

export default ChassisForm;
