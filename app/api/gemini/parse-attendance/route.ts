import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

// Fallback logic for sandbox or if the user hasn't configured the API Key
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

export async function POST(req: NextRequest) {
  try {
    const { text, students } = await req.json();

    if (!text || !students || !Array.isArray(students)) {
      return NextResponse.json({ error: "Siswa atau teks input tidak valid." }, { status: 400 });
    }

    const ai = getGeminiClient();

    // If API key is missing, provide an elegant mock parser that matches sample keywords.
    // This allows the app to be fully interactive and testable immediately in sandbox!
    if (!ai) {
      console.warn("GEMINI_API_KEY is not configured. Falling back to local keyword parsing for demonstration.");
      
      const parsedRecords: any[] = [];
      const lowerText = text.toLowerCase();

      students.forEach((s: any) => {
        const nameLower = s.name.toLowerCase();
        // Simple search for name
        if (lowerText.includes(nameLower) || nameLower.split(" ").some((part: string) => part.length > 2 && lowerText.includes(part))) {
          // Determine status based on nearby keywords or overall text keywords
          let status: "sakit" | "izin" | "alpa" = "alpa";
          let note = "";

          if (lowerText.includes("sakit") || lowerText.includes("demem") || lowerText.includes("flu") || lowerText.includes("pusing")) {
            status = "sakit";
            note = "Sakit (Dideteksi otomatis)";
          } else if (lowerText.includes("izin") || lowerText.includes("pergi") || lowerText.includes("acara") || lowerText.includes("keluarga")) {
            status = "izin";
            note = "Izin keperluan keluarga (Dideteksi otomatis)";
          } else {
            status = "alpa";
            note = "Tanpa Keterangan / Alpa (Dideteksi otomatis)";
          }

          parsedRecords.push({
            studentId: s.id,
            studentName: s.name,
            status,
            note
          });
        }
      });

      return NextResponse.json({ 
        data: parsedRecords,
        warning: "Demo Mode: Menggunakan pencocokan kata lokal karena kunci API Gemini belum dikonfigurasi."
      });
    }

    const prompt = `Lakukan analisis terhadap transkrip ketidakhadiran murid di bawah ini:
"${text}"

Berikut adalah daftar murid kelas yang valid (roster):
${JSON.stringify(students)}

Tentukan murid mana saja dari daftar di atas yang tidak hadir, tentukan jenis status ketidakhadirannya (sakit, izin atau alpa), dan sertakan catatan ringkas tentang keterangannya. Abaikan siswa yang hadir atau tidak disebutkan tidak hadir.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an intelligent school registration AI assistant. Your task is to map casual school attendance transcripts or parent chats to a valid roster of students as accurately as possible. Match nicknames, spelling variations, or first names inside the transcript to the proper student record ID in the provided roster. Return only students who are absent (unexcused/alpa, excused/izin, or sick/sakit). If no students from the roster match, return an empty array.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            data: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  studentId: { type: Type.STRING, description: "ID siswa yang cocok dari roster" },
                  studentName: { type: Type.STRING, description: "Nama lengkap siswa sesuai roster" },
                  status: { type: Type.STRING, description: "Status absensi murid, wajib salah satu dari: 'sakit', 'izin', atau 'alpa'" },
                  note: { type: Type.STRING, description: "Sebab atau alasan ketidakhadiran murid secara ringkas" }
                },
                required: ["studentId", "studentName", "status", "note"]
              }
            }
          },
          required: ["data"]
        }
      }
    });

    const outputText = response.text || "{\"data\": []}";
    const parsedJson = JSON.parse(outputText.trim());
    return NextResponse.json(parsedJson);

  } catch (err: any) {
    console.error("Gagal menjalankan parser ketidakhadiran AI:", err);
    return NextResponse.json({ error: "Gagal memproses draf presensi AI. Silakan coba beberapa saat lagi." }, { status: 500 });
  }
}
