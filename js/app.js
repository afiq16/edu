/**
 * EduCheck Main Application Controller
 * Handles State, Authentication, Real-time Khata Submissions, Canvas Grading, and Notification Triggers
 */

// Application State
const state = {
    currentUser: null, // { role: 'teacher' | 'student', ... }
    role: 'student', // 'student' | 'teacher'
    students: [],
    assignments: [],
    submissions: [],
    notifications: [],
    attendance: [],
    doubts: [],
    studyMaterials: [],
    notices: [],
    currentEvaluatingSubmission: null,
    currentEvaluatingPageIndex: 0,
    evaluator: null,
    selectedUploadImages: [],
    otpCountdownTimer: null,
    selectedAttendanceDate: new Date().toISOString().split('T')[0],
    currentDoubtToResolve: null,
    doubtMediaRecorder: null,
    doubtAudioChunks: [],
    currentDoubtAudioBlob: null,
    currentViewingNotice: null
};

// Blank Baseline State (No Mock Dummy Data - 100% Fresh & Clean)
const DEMO_STUDENTS = [];
const DEMO_ASSIGNMENTS = [];
const SAMPLE_KHATA_IMAGE = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='1000' viewBox='0 0 800 1000'><rect width='800' height='1000' fill='%23fafafa'/><line x1='60' y1='0' x2='60' y2='1000' stroke='%23fca5a5' stroke-width='2'/><line x1='0' y1='80' x2='800' y2='80' stroke='%23bae6fd' stroke-width='2'/><g stroke='%23e2e8f0' stroke-width='1'><line x1='60' y1='140' x2='760' y2='140'/><line x1='60' y1='200' x2='760' y2='200'/><line x1='60' y1='260' x2='760' y2='260'/><line x1='60' y1='320' x2='760' y2='320'/><line x1='60' y1='380' x2='760' y2='380'/><line x1='60' y1='440' x2='760' y2='440'/><line x1='60' y1='500' x2='760' y2='500'/><line x1='60' y1='560' x2='760' y2='560'/><line x1='60' y1='620' x2='760' y2='620'/><line x1='60' y1='680' x2='760' y2='680'/><line x1='60' y1='740' x2='760' y2='740'/><line x1='60' y1='800' x2='760' y2='800'/></g><text x='80' y='50' font-family='sans-serif' font-size='20' font-weight='bold' fill='%23334155'>হোমওয়ার্ক / পরীক্ষার খাতা</text></svg>";
const DEMO_SUBMISSIONS = [];

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener("DOMContentLoaded", async () => {
    // 0. Initialize theme immediately
    initTheme();

    // 1. Immediately restore session synchronously to eliminate any login screen flash
    checkRememberedSession();

    if (typeof initFirebaseApp === 'function') {
        initFirebaseApp();
    }
    await initDatabase();
    initEvaluatorCanvas();
    initOtpInputAutoJump();

    // 2. Refresh active session with latest database data
    syncRememberedSessionWithDb();

    renderAllViews();
    setupRealtimeFirebaseListeners();
    initExamCountdownTicking();
    updateLiveNoticeAlert();

    // 3. Smoothly dismiss fast App Splash Screen
    setTimeout(() => {
        hideSplashScreen();
    }, 750);
});

/**
 * Setup real-time updates from Firebase Cloud Firestore for ALL collections
 */
function setupRealtimeFirebaseListeners() {
    if (typeof fbFirestore !== 'undefined' && fbFirestore) {
        try {
            // 1. Listen for students in real-time
            fbFirestore.collection("students").onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    const data = change.doc.data();
                    if (!data || !data.id) return;
                    const index = state.students.findIndex(s => s.id === data.id);
                    if (change.type === "added") {
                        if (index === -1) state.students.push(data);
                        else state.students[index] = data;
                    } else if (change.type === "modified") {
                        if (index !== -1) state.students[index] = data;
                        else state.students.push(data);
                    } else if (change.type === "removed") {
                        if (index !== -1) state.students.splice(index, 1);
                    }
                    window.dbStorage.setLocal("students", data);
                });

                // Update active student session if their data changed
                if (state.currentUser && state.currentUser.role === 'student') {
                    const myUpdated = state.students.find(s => s.id === state.currentUser.id || s.phone === state.currentUser.phone);
                    if (myUpdated) {
                        state.currentUser = { ...state.currentUser, ...myUpdated };
                        localStorage.setItem("educheck_saved_user_data", JSON.stringify(state.currentUser));
                    }
                }

                if (state.currentUser?.role === 'teacher') {
                    renderTeacherRoster();
                    renderTeacherDashboard();
                } else if (state.currentUser?.role === 'student') {
                    renderStudentDashboard();
                }
            }, err => console.warn("Students listener notice:", err));

            // 2. Listen for assignments in real-time
            fbFirestore.collection("assignments").onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    const data = change.doc.data();
                    if (!data || !data.id) return;
                    const index = state.assignments.findIndex(a => a.id === data.id);
                    if (change.type === "added") {
                        if (index === -1) state.assignments.unshift(data);
                        else state.assignments[index] = data;
                    } else if (change.type === "modified") {
                        if (index !== -1) state.assignments[index] = data;
                        else state.assignments.unshift(data);
                    } else if (change.type === "removed") {
                        if (index !== -1) state.assignments.splice(index, 1);
                    }
                    window.dbStorage.setLocal("assignments", data);
                });

                if (state.currentUser?.role === 'teacher') {
                    renderTeacherDashboard();
                } else if (state.currentUser?.role === 'student') {
                    renderStudentDashboard();
                }
            }, err => console.warn("Assignments listener notice:", err));

            // 3. Listen for submissions in real-time
            fbFirestore.collection("submissions").onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    const data = change.doc.data();
                    if (!data || !data.id) return;
                    const index = state.submissions.findIndex(s => s.id === data.id);
                    if (change.type === "added") {
                        if (index === -1) {
                            state.submissions.unshift(data);
                            window.dbStorage.setLocal("submissions", data);
                        } else {
                            const localSub = state.submissions[index];
                            if (localSub && localSub.status === 'checked' && data.status === 'pending') {
                                window.dbStorage.set("submissions", localSub);
                                return;
                            }
                            state.submissions[index] = data;
                            window.dbStorage.setLocal("submissions", data);
                        }
                    } else if (change.type === "modified") {
                        if (index !== -1) {
                            const localSub = state.submissions[index];
                            if (localSub && localSub.status === 'checked' && data.status === 'pending') {
                                window.dbStorage.set("submissions", localSub);
                                return;
                            }
                            state.submissions[index] = data;
                            window.dbStorage.setLocal("submissions", data);
                        } else {
                            state.submissions.unshift(data);
                            window.dbStorage.setLocal("submissions", data);
                        }
                    } else if (change.type === "removed") {
                        if (index !== -1) state.submissions.splice(index, 1);
                    }
                });
                if (state.currentUser?.role === 'teacher') {
                    renderTeacherDashboard();
                } else if (state.currentUser?.role === 'student') {
                    renderStudentDashboard();
                }
            }, err => console.warn("Submissions listener notice:", err));

            // 4. Listen for daily attendance in real-time
            fbFirestore.collection("attendance").onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    const data = change.doc.data();
                    if (!data || !data.id) return;
                    const index = state.attendance.findIndex(a => a.id === data.id);
                    if (change.type === "added") {
                        if (index === -1) state.attendance.push(data);
                        else state.attendance[index] = data;
                    } else if (change.type === "modified") {
                        if (index !== -1) state.attendance[index] = data;
                        else state.attendance.push(data);
                    } else if (change.type === "removed") {
                        if (index !== -1) state.attendance.splice(index, 1);
                    }
                    window.dbStorage.setLocal("attendance", data);
                });
                if (state.currentUser?.role === 'teacher') {
                    loadAttendanceForSelectedDate();
                } else if (state.currentUser?.role === 'student') {
                    renderStudentDashboard();
                }
            }, err => console.warn("Attendance listener notice:", err));

            // 5. Listen for doubts / questions in real-time
            fbFirestore.collection("doubts").onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    const data = change.doc.data();
                    if (!data || !data.id) return;
                    const index = state.doubts.findIndex(d => d.id === data.id);
                    if (change.type === "added") {
                        if (index === -1) state.doubts.unshift(data);
                        else state.doubts[index] = data;
                    } else if (change.type === "modified") {
                        if (index !== -1) state.doubts[index] = data;
                        else state.doubts.unshift(data);
                    } else if (change.type === "removed") {
                        if (index !== -1) state.doubts.splice(index, 1);
                    }
                    window.dbStorage.setLocal("doubts", data);
                });
                if (state.currentUser?.role === 'teacher') {
                    renderTeacherDoubts();
                } else if (state.currentUser?.role === 'student') {
                    renderStudentDoubts();
                }
            }, err => console.warn("Doubts listener notice:", err));

            // 6. Listen for study materials in real-time
            fbFirestore.collection("study_materials").onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    const data = change.doc.data();
                    if (!data || !data.id) return;
                    const index = state.studyMaterials.findIndex(m => m.id === data.id);
                    if (change.type === "added") {
                        if (index === -1) state.studyMaterials.unshift(data);
                        else state.studyMaterials[index] = data;
                    } else if (change.type === "modified") {
                        if (index !== -1) state.studyMaterials[index] = data;
                        else state.studyMaterials.unshift(data);
                    } else if (change.type === "removed") {
                        if (index !== -1) state.studyMaterials.splice(index, 1);
                    }
                    window.dbStorage.setLocal("study_materials", data);
                });
                if (state.currentUser?.role === 'teacher') {
                    renderTeacherStudyMaterials();
                } else if (state.currentUser?.role === 'student') {
                    renderStudentStudyMaterials();
                }
            }, err => console.warn("Study materials listener notice:", err));

            // 7. Listen for notice board broadcasts in real-time
            fbFirestore.collection("notices").onSnapshot((snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    const data = change.doc.data();
                    if (!data || !data.id) return;
                    const index = state.notices.findIndex(n => n.id === data.id);
                    if (change.type === "added") {
                        if (index === -1) state.notices.unshift(data);
                        else state.notices[index] = data;
                    } else if (change.type === "modified") {
                        if (index !== -1) state.notices[index] = data;
                        else state.notices.unshift(data);
                    } else if (change.type === "removed") {
                        if (index !== -1) state.notices.splice(index, 1);
                    }
                    window.dbStorage.setLocal("notices", data);
                });
                updateLiveNoticeAlert();
                if (state.currentUser?.role === 'teacher') {
                    renderTeacherNotices();
                } else if (state.currentUser?.role === 'student') {
                    renderStudentNotices();
                }
            }, err => console.warn("Notices listener notice:", err));

            console.log("📡 Real-time Cloud Firestore sync active across ALL collections (Students, HW, Khata, Attendance, Doubts, Notes, Notices)");
        } catch (err) {
            console.warn("Real-time listener setup error:", err);
        }
    }
}

/**
 * Generate sequential student ID starting from STU-101
 */
function generateNextStudentId() {
    if (!state.students || state.students.length === 0) {
        return "STU-101";
    }
    let maxNum = 100;
    state.students.forEach(s => {
        if (s && s.id) {
            const m = s.id.match(/\d+/);
            if (m) {
                const val = parseInt(m[0], 10);
                if (val > maxNum) maxNum = val;
            }
        }
    });
    return "STU-" + (maxNum + 1);
}

/**
 * Initialize Database and sync with Cloud Firestore
 */
async function initDatabase() {
    try {
        const [students, assigns, subs, notifs, atts, doubts, materials, notices] = await Promise.all([
            window.dbStorage.getAll("students"),
            window.dbStorage.getAll("assignments"),
            window.dbStorage.getAll("submissions"),
            window.dbStorage.getAll("notifications"),
            window.dbStorage.getAll("attendance"),
            window.dbStorage.getAll("doubts"),
            window.dbStorage.getAll("study_materials"),
            window.dbStorage.getAll("notices")
        ]);

        state.students = students || [];
        state.assignments = assigns || [];
        state.submissions = subs || [];
        state.notifications = notifs || [];
        state.attendance = atts || [];
        state.doubts = doubts || [];
        state.studyMaterials = materials || [];
        state.notices = notices || [];
        console.log(`📊 Initial database loaded: ${state.students.length} students, ${state.assignments.length} assignments, ${state.submissions.length} submissions`);
    } catch (err) {
        console.error("Database initialization error:", err);
        state.students = [];
        state.assignments = [];
        state.submissions = [];
        state.notifications = [];
        state.attendance = [];
        state.doubts = [];
        state.studyMaterials = [];
        state.notices = [];
    }
}

/**
 * Initialize Canvas Evaluator & Toolbar buttons
 */
function initEvaluatorCanvas() {
    state.evaluator = new KhataCanvasEvaluator("khataCanvas");

    // Tool switcher buttons
    document.querySelectorAll(".tool-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".tool-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            state.evaluator.currentTool = btn.dataset.tool;
        });
    });

    // Color buttons
    document.querySelectorAll(".color-circle").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".color-circle").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            state.evaluator.currentColor = btn.dataset.color;
            if (state.evaluator.currentTool === 'eraser') {
                document.getElementById("toolPen").click();
            }
        });
    });

    // Brush slider
    const sizeSlider = document.getElementById("brushSizeSlider");
    const sizeLabel = document.getElementById("brushSizeDisplay");
    if (sizeSlider && sizeLabel) {
        sizeSlider.addEventListener("input", (e) => {
            state.evaluator.brushSize = parseInt(e.target.value);
            sizeLabel.textContent = `${e.target.value}px`;
        });
    }

    // Notification dropdown toggle
    const bellBtn = document.getElementById("notifBellBtn");
    const notifDropdown = document.getElementById("notifDropdown");
    if (bellBtn && notifDropdown) {
        bellBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            notifDropdown.classList.toggle("show");
        });
        window.addEventListener("click", () => notifDropdown.classList.remove("show"));
    }

    // Role switcher in header
    document.getElementById("headerStudentBtn")?.addEventListener("click", () => switchAuthTab('student'));
    document.getElementById("headerTeacherBtn")?.addEventListener("click", () => switchAuthTab('teacher'));
    document.getElementById("brandLogo")?.addEventListener("click", () => {
        if (!state.currentUser) switchAuthTab('student');
    });
}

/**
 * Auto Jump for 4-digit OTP input boxes
 */
function initOtpInputAutoJump() {
    const otpBoxes = document.querySelectorAll(".otp-box");
    otpBoxes.forEach((box, idx) => {
        box.addEventListener("input", (e) => {
            if (e.target.value.length === 1) {
                if (idx < otpBoxes.length - 1) {
                    otpBoxes[idx + 1].focus();
                }
            }
            updateCombinedOtp();
        });

        box.addEventListener("keydown", (e) => {
            if (e.key === "Backspace" && !e.target.value && idx > 0) {
                otpBoxes[idx - 1].focus();
            }
        });

        // Paste support for 4 to 6 digits
        box.addEventListener("paste", (e) => {
            e.preventDefault();
            const pasteData = (e.clipboardData || window.clipboardData).getData('text').trim();
            if (/^\d+$/.test(pasteData)) {
                const digits = pasteData.slice(0, 6).split('');
                digits.forEach((digit, i) => {
                    if (otpBoxes[i]) otpBoxes[i].value = digit;
                });
                updateCombinedOtp();
                if (otpBoxes[digits.length - 1]) otpBoxes[digits.length - 1].focus();
            }
        });
    });
}

function updateCombinedOtp() {
    const otpBoxes = document.querySelectorAll(".otp-box");
    let combined = "";
    otpBoxes.forEach(box => combined += box.value);
    const combinedEl = document.getElementById("studentOtpCombined");
    if (combinedEl) combinedEl.value = combined;
}

// ==========================================================================
// AUTHENTICATION CONTROLLER (STUDENT & TEACHER)
// ==========================================================================
function switchAuthTab(role) {
    state.role = role;

    // Guarantee authSection is displayed and portals are hidden
    const authSection = document.getElementById("authSection");
    if (authSection) authSection.style.display = "flex";

    const teacherPortal = document.getElementById("teacherPortalView");
    const studentPortal = document.getElementById("studentPortalView");
    if (teacherPortal && (!state.currentUser || state.currentUser.role !== 'teacher')) teacherPortal.style.display = "none";
    if (studentPortal && (!state.currentUser || state.currentUser.role !== 'student')) studentPortal.style.display = "none";

    const tabStudent = document.getElementById("tabStudentLogin");
    const tabTeacher = document.getElementById("tabTeacherLogin");
    const paneStudent = document.getElementById("studentLoginPane");
    const paneTeacher = document.getElementById("teacherLoginPane");
    const headerStudentBtn = document.getElementById("headerStudentBtn");
    const headerTeacherBtn = document.getElementById("headerTeacherBtn");

    if (role === 'student') {
        tabStudent?.classList.add("active");
        tabTeacher?.classList.remove("active");
        if (paneStudent) {
            paneStudent.classList.add("active");
            paneStudent.style.display = "block";
        }
        if (paneTeacher) {
            paneTeacher.classList.remove("active");
            paneTeacher.style.display = "none";
        }
        headerStudentBtn?.classList.add("active");
        headerTeacherBtn?.classList.remove("active");
    } else {
        tabTeacher?.classList.add("active");
        tabStudent?.classList.remove("active");
        if (paneTeacher) {
            paneTeacher.classList.add("active");
            paneTeacher.style.display = "block";
        }
        if (paneStudent) {
            paneStudent.classList.remove("active");
            paneStudent.style.display = "none";
        }
        headerTeacherBtn?.classList.add("active");
        headerStudentBtn?.classList.remove("active");
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.switchAuthTab = switchAuthTab;

/**
 * Normalize Bengali numerals (০-৯) to English ASCII digits (0-9)
 */
function normalizeDigits(str) {
    if (!str) return '';
    const bnDigits = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
    return String(str).replace(/[০-৯]/g, d => bnDigits.indexOf(d));
}
window.normalizeDigits = normalizeDigits;

/**
 * Switch between Student Login sub-tab and Student Register sub-tab
 */
function switchStudentAuthSubTab(subTab) {
    const tabLogin = document.getElementById("subTabStudentLogin");
    const tabRegister = document.getElementById("subTabStudentRegister");
    const formLogin = document.getElementById("studentPhoneForm");
    const formRegister = document.getElementById("studentRegisterForm");
    const multiSelector = document.getElementById("multiAccountSelector");

    if (subTab === 'register') {
        tabLogin?.classList.remove("active");
        tabRegister?.classList.add("active");
        if (formLogin) formLogin.style.display = "none";
        if (multiSelector) multiSelector.style.display = "none";
        if (formRegister) {
            formRegister.style.display = "block";
            formRegister.classList.add("active");
        }
    } else {
        tabLogin?.classList.add("active");
        tabRegister?.classList.remove("active");
        if (formRegister) formRegister.style.display = "none";
        if (multiSelector) multiSelector.style.display = "none";
        if (formLogin) {
            formLogin.style.display = "block";
            formLogin.classList.add("active");
        }
    }
}
window.switchStudentAuthSubTab = switchStudentAuthSubTab;

/**
 * Student Fast Login with Phone / ID (Direct Access - No OTP)
 */
async function handleStudentLoginDirect(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    const submitBtn = (event && event.target && typeof event.target.querySelector === 'function')
        ? event.target.querySelector('button[type="submit"]')
        : document.getElementById("sendOtpBtn");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> যাচাই হচ্ছে...`;
    }

    try {
        const rawQuery = document.getElementById("studentPhoneInput").value.trim();
        const query = normalizeDigits(rawQuery);

        if (!query) {
            showToast("মোবাইল নম্বর বা শিক্ষার্থী আইডি প্রদান করুন", "warning");
            return;
        }

        // Clean & normalize query for flexible phone and ID matching
        const cleanQuery = query.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const cleanPhoneDigits = query.replace(/[^0-9]/g, '');
        const standardPhoneQuery = cleanPhoneDigits.startsWith('880') ? cleanPhoneDigits.substring(2) : cleanPhoneDigits;

        // Refresh students from DB to ensure any newly added student is present
        try {
            const stored = await window.dbStorage.getAll("students");
            if (stored && stored.length > 0) state.students = stored;
        } catch (e) {}

        // Find students by phone or ID
        const matchingStudents = state.students.filter(s => {
            const sId = (s.id || '').toLowerCase().replace(/[^a-zA-Z0-9]/g, '');
            const sPhone = normalizeDigits(s.phone || '');
            const sPhoneDigits = sPhone.replace(/[^0-9]/g, '');
            const sStandardPhone = sPhoneDigits.startsWith('880') ? sPhoneDigits.substring(2) : sPhoneDigits;

            return (
                s.phone === query ||
                sPhone === query ||
                (cleanPhoneDigits.length >= 6 && sPhoneDigits === cleanPhoneDigits) ||
                (standardPhoneQuery.length >= 6 && sStandardPhone === standardPhoneQuery) ||
                (s.id && s.id.toLowerCase() === query.toLowerCase()) ||
                sId === cleanQuery
            );
        });

        // If no matching student is found: smoothly guide them to register with their name!
        if (!matchingStudents || matchingStudents.length === 0) {
            switchStudentAuthSubTab('register');
            const regPhoneInput = document.getElementById("regStudentPhone");
            if (regPhoneInput) {
                regPhoneInput.value = query;
            }
            const noticeEl = document.getElementById("regNoticeBanner");
            if (noticeEl) {
                noticeEl.innerHTML = `<i class="fa-solid fa-circle-info"></i> <strong>এই নম্বরটি (${query}) নতুন!</strong> অনুগ্রহ করে নিচে আপনার নাম লিখে <strong>'শিক্ষার্থী নিবন্ধন ও প্রবেশ'</strong> বাটনে চাপ দিন।`;
                noticeEl.style.display = "block";
            }
            showToast("💡 এই নম্বরটি নতুন! আপনার নাম লিখে সরাসরি প্রবেশ করুন", "info");
            setTimeout(() => {
                document.getElementById("regStudentName")?.focus();
            }, 100);
            return;
        }

        // If multiple students share this phone number (e.g. siblings)
        if (matchingStudents.length > 1) {
            document.getElementById("studentPhoneForm").style.display = "none";
            document.getElementById("multiAccountSelector").style.display = "block";
            renderMultiAccountSelector(matchingStudents);
            return;
        }

        // Single student - login directly!
        const student = matchingStudents[0];
        loginAsStudent(student);
        showToast(`স্বাগতম ${student.name}! শিক্ষার্থী পোর্টালে প্রবেশ করেছেন।`, "success");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>শিক্ষার্থী পোর্টালে প্রবেশ করুন</span> <i class="fa-solid fa-arrow-right-to-bracket"></i>`;
        }
    }
}
window.handleStudentLoginDirect = handleStudentLoginDirect;

/**
 * Handle Student Self-Registration
 */
async function handleStudentSelfRegister(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    const submitBtn = document.getElementById("btnStudentRegisterSubmit");
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> নিবন্ধন হচ্ছে...`;
    }

    try {
        const rawName = document.getElementById("regStudentName").value.trim();
        const rawPhone = document.getElementById("regStudentPhone").value.trim();
        const studentClass = document.getElementById("regStudentClass").value;
        const subject = document.getElementById("regStudentSubject").value;

        if (!rawName) {
            showToast("দয়া করে আপনার পুরো নাম লিখুন", "warning");
            document.getElementById("regStudentName")?.focus();
            return;
        }

        const phone = normalizeDigits(rawPhone);
        if (!phone || phone.length < 6) {
            showToast("সঠিক মোবাইল নম্বর প্রদান করুন", "warning");
            document.getElementById("regStudentPhone")?.focus();
            return;
        }

        // Check if existing student matches this phone & name
        const cleanPhoneDigits = phone.replace(/[^0-9]/g, '');
        const existingStudent = state.students.find(s => {
            const sDigits = (normalizeDigits(s.phone) || '').replace(/[^0-9]/g, '');
            return (sDigits === cleanPhoneDigits) && (s.name.trim().toLowerCase() === rawName.toLowerCase());
        });

        if (existingStudent) {
            loginAsStudent(existingStudent);
            showToast(`স্বাগতম ${existingStudent.name}! শিক্ষার্থী পোর্টালে প্রবেশ করেছেন।`, "success");
            return;
        }

        // Create new student with sequential ID
        const newStudentId = generateNextStudentId();
        const newStudent = {
            id: newStudentId,
            name: rawName,
            phone: phone,
            class: studentClass || "Class 10",
            subject: subject || "বিজ্ঞান শাখা",
            avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=Student_${newStudentId}`,
            isOtpVerified: true,
            joinedAt: new Date().toISOString()
        };

        state.students.push(newStudent);
        try {
            await window.dbStorage.set("students", newStudent);
        } catch (e) {
            console.warn("Storage notice:", e);
        }

        loginAsStudent(newStudent);
        showToast(`🎉 স্বাগতম ${newStudent.name}! আপনার শিক্ষার্থী আইডি: ${newStudent.id}`, "success");
    } catch (err) {
        showToast("নিবন্ধন ত্রুটি: " + err.message, "error");
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>শিক্ষার্থী নিবন্ধন ও প্রবেশ করুন</span> <i class="fa-solid fa-arrow-right"></i>`;
        }
    }
}
window.handleStudentSelfRegister = handleStudentSelfRegister;

function changeStudentPhone() {
    switchStudentAuthSubTab('login');
    document.getElementById("studentPhoneForm").style.display = "block";
    document.getElementById("multiAccountSelector").style.display = "none";
}
window.changeStudentPhone = changeStudentPhone;

/**
 * Render multi-account selector cards when multiple students share the same SIM
 */
function renderMultiAccountSelector(students) {
    const list = document.getElementById("multiStudentList");
    if (!list) return;

    list.innerHTML = students.map(s => `
        <div class="multi-student-item" onclick="selectStudentProfile('${s.id}')">
            <img src="${s.avatar}" class="multi-student-avatar" alt="${s.name}">
            <div class="multi-student-info">
                <div class="multi-student-name">${s.name}</div>
                <div class="multi-student-meta">${s.class} • ${s.subject}</div>
                <div class="multi-student-id">আইডি: <strong>${s.id}</strong></div>
            </div>
            <button type="button" class="btn btn-primary btn-sm">
                প্রবেশ <i class="fa-solid fa-arrow-right"></i>
            </button>
        </div>
    `).join('') + `
        <button type="button" class="btn btn-outline btn-block" style="margin-top: 1rem;" onclick="changeStudentPhone()">
            <i class="fa-solid fa-arrow-left"></i> অন্য নম্বরে লগইন করুন
        </button>
    `;
}

/**
 * Select specific student profile from multi-account list
 */
async function selectStudentProfile(studentId) {
    const student = state.students.find(s => s.id === studentId);
    if (!student) return;

    loginAsStudent(student);
    showToast(`স্বাগতম ${student.name}!`, "success");
}

/**
 * Auto-fill helper when OTP simulator popup opens
 */
function autoFillSimulatedOtp() {
    if (window.latestReceivedOtp) {
        const digits = window.latestReceivedOtp.split('');
        const otpBoxes = document.querySelectorAll(".otp-box");
        digits.forEach((d, i) => {
            if (otpBoxes[i]) otpBoxes[i].value = d;
        });
        updateCombinedOtp();
        closeModal("smsOtpSimulatorModal");
    }
}

function quickFillStudent(phone) {
    document.getElementById("studentPhoneInput").value = phone;
    document.getElementById("studentPhoneForm").dispatchEvent(new Event("submit"));
}

// Fixed Teacher Credentials Configuration & Helper
const AUTHORIZED_TEACHER_CREDENTIALS = {
    emails: [
        "teacher@gmail.com",
        "teacher@educheck.com",
        "afiq@gmail.com",
        "afiq@educheck.com",
        "teacher",
        "afiq"
    ],
    password: "123456"
};

function getAuthorizedTeacherCredentials() {
    try {
        const custom = localStorage.getItem("educheck_teacher_credentials");
        if (custom) {
            const parsed = JSON.parse(custom);
            if (parsed && parsed.email && parsed.password) {
                return {
                    name: parsed.name || "আফিক স্যার",
                    emails: [parsed.email.toLowerCase().trim(), ...AUTHORIZED_TEACHER_CREDENTIALS.emails],
                    password: parsed.password
                };
            }
        }
    } catch (e) {
        console.warn("Failed to read custom teacher credentials", e);
    }
    return {
        name: "আফিক স্যার",
        emails: AUTHORIZED_TEACHER_CREDENTIALS.emails,
        password: AUTHORIZED_TEACHER_CREDENTIALS.password
    };
}
window.getAuthorizedTeacherCredentials = getAuthorizedTeacherCredentials;

/**
 * Teacher Login handler with strict credential validation
 */
function handleTeacherLogin(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    const emailInput = document.getElementById("teacherEmailInput");
    const passInput = document.getElementById("teacherPasswordInput");
    const email = (emailInput?.value || "").trim();
    const pass = passInput?.value || "";

    if (!email) {
        showToast("শিক্ষকের জিমেইল বা আইডি প্রদান করুন", "warning");
        emailInput?.focus();
        return;
    }

    if (!pass) {
        showToast("পাসওয়ার্ড প্রদান করুন", "warning");
        passInput?.focus();
        return;
    }

    const activeCreds = getAuthorizedTeacherCredentials();
    const cleanEmail = email.toLowerCase().trim();
    const isEmailValid = activeCreds.emails.some(
        validEmail => validEmail.toLowerCase() === cleanEmail
    );
    const isPassValid = (pass === activeCreds.password);

    if (!isEmailValid || !isPassValid) {
        showToast("❌ ভুল জিমেইল অথবা পাসওয়ার্ড! শুধুমাত্র অনুমোদিত শিক্ষক একাউন্ট দিয়ে প্রবেশ করা যাবে।", "error");
        if (passInput) {
            passInput.value = "";
            passInput.focus();
        }
        return;
    }

    const teacherUser = {
        role: "teacher",
        name: `${activeCreds.name} (শিক্ষক)`,
        email: email,
        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=TeacherAfiq"
    };

    localStorage.setItem("educheck_saved_role", "teacher");
    loginAsTeacher(teacherUser);
    showToast(`শিক্ষক পোর্টালে স্বাগতম, ${activeCreds.name}!`, "success");
}
window.handleTeacherLogin = handleTeacherLogin;

function loginAsStudent(student) {
    if (!student) return;
    state.currentUser = { role: "student", ...student };
    localStorage.setItem("educheck_saved_role", "student");
    localStorage.setItem("educheck_current_user", JSON.stringify(state.currentUser));
    if (student.phone) {
        localStorage.setItem("educheck_saved_student_phone", student.phone);
    }
    applyAuthStateUI();
}

function loginAsTeacher(teacher) {
    if (!teacher) return;
    state.currentUser = { role: "teacher", ...teacher };
    localStorage.setItem("educheck_saved_role", "teacher");
    localStorage.setItem("educheck_current_user", JSON.stringify(state.currentUser));
    applyAuthStateUI();
}

function checkRememberedSession() {
    try {
        const savedUserRaw = localStorage.getItem("educheck_current_user");
        const savedRole = localStorage.getItem("educheck_saved_role");

        if (savedUserRaw) {
            try {
                const parsed = JSON.parse(savedUserRaw);
                if (parsed && parsed.role) {
                    state.currentUser = parsed;
                    applyAuthStateUI();
                    return;
                }
            } catch (err) {
                console.warn("Could not parse saved user:", err);
            }
        }

        if (savedRole === "teacher") {
            loginAsTeacher({
                role: "teacher",
                name: "আফিক স্যার (শিক্ষক)",
                email: "teacher@educheck.com",
                avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=TeacherAfiq"
            });
            return;
        }

        if (savedRole === "student") {
            const savedPhone = localStorage.getItem("educheck_saved_student_phone");
            if (savedPhone) {
                const student = state.students?.find(s => s.phone === savedPhone || s.id === savedPhone);
                if (student) {
                    loginAsStudent(student);
                } else {
                    // Safe fallback object so user stays logged in without losing access
                    state.currentUser = {
                        role: "student",
                        id: "STU-" + savedPhone.slice(-3),
                        name: "শিক্ষার্থী (" + savedPhone.slice(-4) + ")",
                        phone: savedPhone,
                        class: "Class 10",
                        group: "বিজ্ঞান শাখা",
                        subject: "বিজ্ঞান শাখা",
                        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${savedPhone}`
                    };
                    applyAuthStateUI();
                }
            }
        }
    } catch (e) {
        console.error("Session restore error:", e);
    }
}

/**
 * Synchronize remembered session with fresh data from database after init
 */
function syncRememberedSessionWithDb() {
    if (!state.currentUser) return;
    if (state.currentUser.role === "student" && state.currentUser.phone) {
        const freshStudent = state.students?.find(s => s.phone === state.currentUser.phone || s.id === state.currentUser.id);
        if (freshStudent) {
            state.currentUser = { role: "student", ...freshStudent };
            localStorage.setItem("educheck_current_user", JSON.stringify(state.currentUser));
            applyAuthStateUI();
        } else {
            // If student exists in session but not in state.students array, persist to state.students
            if (Array.isArray(state.students)) {
                const exists = state.students.some(s => s.id === state.currentUser.id || s.phone === state.currentUser.phone);
                if (!exists && state.currentUser.phone) {
                    state.students.push(state.currentUser);
                    if (window.dbStorage && typeof window.dbStorage.set === 'function') {
                        window.dbStorage.set("students", state.currentUser).catch(err => console.warn(err));
                    }
                }
            }
        }
    }
}

function handleLogout() {
    state.currentUser = null;
    localStorage.removeItem("educheck_saved_role");
    localStorage.removeItem("educheck_saved_student_phone");
    localStorage.removeItem("educheck_current_user");
    applyAuthStateUI();
    showToast("লগআউট সফল হয়েছে", "info");
}
window.handleLogout = handleLogout;

document.getElementById("logoutBtn")?.addEventListener("click", handleLogout);

function applyAuthStateUI() {
    // Remove session restoring anti-flicker class immediately
    document.documentElement.classList.remove("session-restoring");

    const authSection = document.getElementById("authSection");
    const teacherPortal = document.getElementById("teacherPortalView");
    const studentPortal = document.getElementById("studentPortalView");
    const userProfilePill = document.getElementById("userProfilePill");
    const guestRoleSwitch = document.getElementById("guestRoleSwitch");
    const notifBtnWrapper = document.getElementById("notifBtnWrapper");
    const mobileBottomNav = document.getElementById("mobileBottomNav");
    const studentMobGroup = document.getElementById("studentMobileNavGroup");
    const teacherMobGroup = document.getElementById("teacherMobileNavGroup");

    if (!state.currentUser) {
        document.body.classList.remove("is-logged-in");
        document.body.classList.add("is-guest");
        if (authSection) authSection.style.display = "flex";
        if (teacherPortal) teacherPortal.style.display = "none";
        if (studentPortal) studentPortal.style.display = "none";
        if (userProfilePill) userProfilePill.style.display = "none";
        if (notifBtnWrapper) notifBtnWrapper.style.display = "none";
        if (guestRoleSwitch) guestRoleSwitch.style.display = "flex";
        if (mobileBottomNav) mobileBottomNav.style.removeProperty("display");
        return;
    }

    document.body.classList.add("is-logged-in");
    document.body.classList.remove("is-guest");

    if (authSection) authSection.style.display = "none";
    if (guestRoleSwitch) guestRoleSwitch.style.display = "none";
    if (userProfilePill) userProfilePill.style.display = "flex";
    if (notifBtnWrapper) notifBtnWrapper.style.display = "block";
    if (mobileBottomNav) mobileBottomNav.style.removeProperty("display");

    document.getElementById("navUserName").textContent = state.currentUser.name;
    document.getElementById("navUserAvatar").src = state.currentUser.avatar;

    if (state.currentUser.role === "teacher") {
        document.getElementById("navUserRole").textContent = "শিক্ষক (অ্যাডমিন)";
        if (teacherPortal) teacherPortal.style.display = "block";
        if (studentPortal) studentPortal.style.display = "none";
        if (studentMobGroup) studentMobGroup.style.display = "none";
        if (teacherMobGroup) teacherMobGroup.style.display = "flex";
        renderTeacherDashboard();
    } else {
        document.getElementById("navUserRole").textContent = `শিক্ষার্থী (${state.currentUser.class || 'Class 10'})`;
        if (teacherPortal) teacherPortal.style.display = "none";
        if (studentPortal) studentPortal.style.display = "block";
        if (studentMobGroup) studentMobGroup.style.display = "flex";
        if (teacherMobGroup) teacherMobGroup.style.display = "none";
        renderStudentDashboard();
    }

    updateNotificationsUI();
}

function setActiveMobNav(btnEl) {
    if (!btnEl) return;
    document.querySelectorAll(".mobile-nav-item").forEach(b => b.classList.remove("active"));
    btnEl.classList.add("active");
}

// ==========================================================================
// TEACHER DASHBOARD LOGIC
// ==========================================================================
function switchTeacherTab(tabName) {
    document.querySelectorAll(".view-tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".teacher-tab-pane").forEach(p => p.style.display = "none");
    document.querySelectorAll("#teacherMobileNavGroup .mobile-nav-item").forEach(b => b.classList.remove("active"));

    if (tabName === 'submissions') {
        document.getElementById("tabTeacherSubmissions")?.classList.add("active");
        document.getElementById("mobNavTeacherSubs")?.classList.add("active");
        const pane = document.getElementById("paneSubmissions");
        if (pane) pane.style.display = "block";
        renderTeacherSubmissions();
    } else if (tabName === 'students') {
        document.getElementById("tabTeacherStudents")?.classList.add("active");
        document.getElementById("mobNavTeacherStudents")?.classList.add("active");
        const pane = document.getElementById("paneStudents");
        if (pane) pane.style.display = "block";
        renderTeacherStudentsList();
    } else if (tabName === 'assignments') {
        document.getElementById("tabTeacherAssignments")?.classList.add("active");
        document.getElementById("mobNavTeacherAssigns")?.classList.add("active");
        const pane = document.getElementById("paneAssignments");
        if (pane) pane.style.display = "block";
        renderTeacherAssignments();
    } else if (tabName === 'attendance') {
        document.getElementById("tabTeacherAttendance")?.classList.add("active");
        const pane = document.getElementById("paneTeacherAttendance");
        if (pane) pane.style.display = "block";
        loadAttendanceForSelectedDate();
    } else if (tabName === 'doubts') {
        document.getElementById("tabTeacherDoubts")?.classList.add("active");
        const pane = document.getElementById("paneTeacherDoubts");
        if (pane) pane.style.display = "block";
        renderTeacherDoubts();
    } else if (tabName === 'studyMaterials') {
        document.getElementById("tabTeacherStudyMaterials")?.classList.add("active");
        const pane = document.getElementById("paneTeacherStudyMaterials");
        if (pane) pane.style.display = "block";
        renderTeacherStudyMaterials();
    } else if (tabName === 'notices') {
        document.getElementById("tabTeacherNotices")?.classList.add("active");
        const pane = document.getElementById("paneTeacherNotices");
        if (pane) pane.style.display = "block";
        renderTeacherNotices();
    }
}

function renderTeacherDashboard() {
    // Stats calculation
    const totalStudents = state.students.length;
    const pendingKhata = state.submissions.filter(s => s.status === 'pending').length;
    const checkedKhata = state.submissions.filter(s => s.status === 'checked').length;
    const totalAssignments = state.assignments.length;

    const pendingDoubts = state.doubts.filter(d => d.status === 'pending').length;
    const doubtBadge = document.getElementById("teacherPendingDoubtsCount");
    if (doubtBadge) doubtBadge.textContent = pendingDoubts;

    document.getElementById("statTotalStudents").textContent = totalStudents;
    document.getElementById("statPendingKhata").textContent = pendingKhata;
    document.getElementById("statCheckedKhata").textContent = checkedKhata;
    document.getElementById("statTotalAssignments").textContent = totalAssignments;
    document.getElementById("pendingSubCount").textContent = pendingKhata;

    renderTeacherSubmissions();
    updateLiveNoticeAlert();
}

function renderTeacherSubmissions() {
    const grid = document.getElementById("teacherSubmissionsGrid");
    const searchQuery = (document.getElementById("submissionSearchInput")?.value || "").toLowerCase();
    const statusFilter = document.getElementById("filterSubmissionStatus")?.value || "all";
    const typeFilter = document.getElementById("filterSubmissionType")?.value || "all";

    let filtered = state.submissions.filter(sub => {
        const matchSearch = sub.studentName.toLowerCase().includes(searchQuery) ||
                            sub.studentId.toLowerCase().includes(searchQuery) ||
                            sub.assignmentTitle.toLowerCase().includes(searchQuery);
        const matchStatus = (statusFilter === 'all') || (sub.status === statusFilter);
        const matchType = (typeFilter === 'all') || (sub.assignmentType === typeFilter);
        return matchSearch && matchStatus && matchType;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1rem; background: white; border-radius: 12px; border: 1px dashed #cbd5e1;">
                <i class="fa-solid fa-folder-open" style="font-size: 2.5rem; color: #94a3b8; margin-bottom: 10px;"></i>
                <h4 style="color: #475569;">কোনো খাতা জমা পাওয়া যায়নি</h4>
                <p style="font-size: 0.85rem;">শিক্ষার্থীরা খাতা জমা দিলে এখানে প্রদর্শিত হবে</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(sub => {
        const isPending = sub.status === 'pending';
        const dateFormatted = formatBanglaDateTime(sub.submittedAt);
        const thumbImg = (sub.pages && sub.pages.length > 0) ? sub.pages[0] : SAMPLE_KHATA_IMAGE;
        
        return `
            <div class="submission-card ${isPending ? 'status-pending' : 'status-checked'}">
                <div class="sub-card-header">
                    <div class="sub-student-meta">
                        <img src="${sub.studentAvatar}" class="sub-avatar" alt="${sub.studentName}">
                        <div>
                            <div class="sub-student-name">${sub.studentName}</div>
                            <div class="sub-student-class">${sub.studentClass} • ID: ${sub.studentId}</div>
                        </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="badge ${isPending ? 'badge-subject' : 'badge-class'}">
                            ${isPending ? '⏳ অপেক্ষমান' : '✅ দেখা শেষ'}
                        </span>
                        <button type="button" class="btn btn-ghost btn-sm text-danger" onclick="deleteSubmission('${sub.id}', '${sub.studentName}')" title="খাতা মুছুন" style="padding: 4px 8px; border-radius: 6px;">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
                <div class="sub-card-body">
                    <div class="sub-assignment-title">${sub.assignmentTitle}</div>
                    <div class="sub-time-meta">
                        <i class="fa-regular fa-clock"></i> জমা: <strong>${dateFormatted}</strong>
                    </div>

                    <div class="sub-preview-thumbnails">
                        ${sub.pages.map((p, i) => `
                            <img src="${p}" class="sub-thumb" title="পৃষ্ঠা ${i+1}">
                        `).join('')}
                    </div>

                    ${sub.studentNote ? `
                        <div class="sub-student-note">
                            <i class="fa-solid fa-quote-left"></i> ${sub.studentNote}
                        </div>
                    ` : ''}

                    ${sub.evaluation ? `
                        <div class="sub-evaluation-summary">
                            <span>প্রাপ্ত নম্বর: ${sub.evaluation.obtainedMarks}/${sub.evaluation.totalMarks} (${sub.evaluation.grade})</span>
                            <i class="fa-solid fa-circle-check"></i>
                        </div>
                    ` : ''}
                </div>
                <div class="sub-card-footer">
                    ${isPending ? `
                        <button class="btn btn-primary btn-block" onclick="openKhataEvaluator('${sub.id}')">
                            <i class="fa-solid fa-pen-to-square"></i> খাতা দেখুন ও লাল কালিতে কাটুন
                        </button>
                    ` : `
                        <div style="display: flex; gap: 6px; width: 100%;">
                            <button class="btn btn-outline" style="flex: 1;" onclick="openKhataEvaluator('${sub.id}')">
                                <i class="fa-solid fa-eye"></i> খাতা দেখুন
                            </button>
                            <button class="btn btn-success" style="padding: 0.5rem 0.75rem;" onclick="sendWhatsAppKhataResult('${sub.id}')" title="অভিভাবকের WhatsApp এ ফলাফল পাঠান">
                                <i class="fa-brands fa-whatsapp"></i> WhatsApp
                            </button>
                        </div>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

function filterSubmissions() {
    renderTeacherSubmissions();
}

function renderTeacherStudentsList() {
    const grid = document.getElementById("teacherStudentsGrid");
    const query = (document.getElementById("studentSearchInput")?.value || "").toLowerCase();

    const filtered = state.students.filter(s => 
        s.name.toLowerCase().includes(query) ||
        s.phone.includes(query) ||
        s.id.toLowerCase().includes(query) ||
        s.class.toLowerCase().includes(query)
    );

    if (filtered.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1.5rem; background: white; border-radius: 12px; border: 1px dashed #cbd5e1;">
                <i class="fa-solid fa-user-plus" style="font-size: 2.5rem; color: #94a3b8; margin-bottom: 12px;"></i>
                <h4 style="color: #475569; margin-bottom: 6px;">এখনো কোনো শিক্ষার্থী যুক্ত করা হয়নি</h4>
                <p style="font-size: 0.85rem; margin-bottom: 15px;">নতুন শিক্ষার্থী যোগ করতে নিচের বাটনে ক্লিক করুন</p>
                <button class="btn btn-primary btn-sm" onclick="openAddStudentModal()">
                    <i class="fa-solid fa-plus"></i> শিক্ষার্থী যুক্ত করুন
                </button>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(s => `
        <div class="student-roster-card">
            <img src="${s.avatar}" class="roster-avatar" alt="${s.name}">
            <div class="roster-info">
                <div class="roster-name">${s.name}</div>
                <div class="roster-meta">${s.class} • ${s.subject}</div>
                <div class="roster-phone"><i class="fa-solid fa-phone"></i> ${s.phone}</div>
                <div style="font-size: 0.75rem; color: #64748b; margin-top: 8px; display: flex; justify-content: space-between; align-items: center; gap: 4px; flex-wrap: wrap;">
                    <span>আইডি: <strong>${s.id}</strong></span>
                    <div style="display: flex; gap: 4px;">
                        <button type="button" class="btn btn-outline btn-sm" onclick="openStudentReportCardModal('${s.id}')" title="মার্কশিট ও প্রগ্রেস রিপোর্ট" style="padding: 2px 7px; font-size: 0.74rem;">
                            <i class="fa-solid fa-file-invoice"></i> রিপোর্ট
                        </button>
                        <button type="button" class="btn btn-ghost btn-sm text-danger" onclick="deleteStudent('${s.id}', '${s.name}')" title="শিক্ষার্থী মুছে ফেলুন" style="padding: 2px 6px; border-radius: 4px; font-size: 0.74rem;">
                            <i class="fa-solid fa-trash-can"></i> মুছুন
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function renderTeacherAssignments() {
    const grid = document.getElementById("teacherAssignmentsGrid");
    if (!state.assignments || state.assignments.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1.5rem; background: white; border-radius: 12px; border: 1px dashed #cbd5e1;">
                <i class="fa-solid fa-file-circle-plus" style="font-size: 2.5rem; color: #94a3b8; margin-bottom: 12px;"></i>
                <h4 style="color: #475569; margin-bottom: 6px;">এখনো কোনো হোমওয়ার্ক বা পরীক্ষা তৈরি করা হয়নি</h4>
                <p style="font-size: 0.85rem; margin-bottom: 15px;">শিক্ষার্থীদের জন্য নতুন কাজ প্রকাশ করতে বাটন চাপুন</p>
                <button class="btn btn-success btn-sm" onclick="openCreateAssignmentModal()">
                    <i class="fa-solid fa-plus"></i> নতুন তৈরি করুন
                </button>
            </div>
        `;
        return;
    }

    grid.innerHTML = state.assignments.map(a => `
        <div class="assignment-card">
            <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                    <span class="assign-type-badge ${a.type === 'homework' ? 'assign-type-homework' : 'assign-type-exam'}">
                        ${a.type === 'homework' ? 'হোমওয়ার্ক' : 'পরীক্ষার খাতা'}
                    </span>
                    <button type="button" class="btn btn-ghost btn-sm text-danger" onclick="deleteAssignment('${a.id}', '${a.title}')" title="মুছে ফেলুন" style="padding: 2px 6px;">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </div>
                <div class="assign-title">${a.title}</div>
                <p style="font-size: 0.85rem;">${a.description || ''}</p>
            </div>
            <div>
                <div class="assign-deadline" style="margin-bottom: 6px;">
                    <i class="fa-regular fa-clock"></i> শেষ সময়: ${formatBanglaDateTime(a.deadline)}
                </div>
                <div data-deadline="${a.deadline}">
                    ${getExamCountdownHtml(a.deadline)}
                </div>
            </div>
        </div>
    `).join('');
}

async function deleteStudent(studentId, studentName) {
    if (!confirm(`আপনি কি শিক্ষার্থী "${studentName}" (ID: ${studentId}) কে মুছে ফেলতে চান?`)) return;
    state.students = state.students.filter(s => s.id !== studentId);
    await window.dbStorage.delete("students", studentId);
    renderTeacherDashboard();
    renderTeacherStudentsList();
    showToast(`শিক্ষার্থী ${studentName} কে মুছে ফেলা হয়েছে`, "info");
}

async function deleteAssignment(assignmentId, title) {
    if (!confirm(`আপনি কি "${title}" মুছে ফেলতে চান?`)) return;
    state.assignments = state.assignments.filter(a => a.id !== assignmentId);
    await window.dbStorage.delete("assignments", assignmentId);
    renderTeacherDashboard();
    renderTeacherAssignments();
    showToast("হোমওয়ার্ক / পরীক্ষা মুছে ফেলা হয়েছে", "info");
}

async function deleteSubmission(submissionId, studentName) {
    if (!confirm(`আপনি কি ${studentName}-এর এই খাতাটি মুছে ফেলতে চান?`)) return;
    state.submissions = state.submissions.filter(s => s.id !== submissionId);
    await window.dbStorage.delete("submissions", submissionId);
    renderTeacherDashboard();
    showToast("খাতা মুছে ফেলা হয়েছে", "info");
}

// ==========================================================================
// STUDENT REGISTRATION (TEACHER ACTION)
// ==========================================================================
function openAddStudentModal() {
    document.getElementById("addStudentForm").reset();
    randomizeStudentAvatar();
    openModal("addStudentModal");
}

function randomizeStudentAvatar() {
    const seed = "Student_" + Math.random().toString(36).substring(7);
    const url = `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`;
    document.getElementById("previewStudentAvatar").src = url;
}

function previewNewStudentPhoto(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById("previewStudentAvatar").src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
}

async function handleSaveNewStudent(event) {
    event.preventDefault();
    const saveBtn = document.getElementById("saveStudentSubmitBtn");
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> সংরক্ষণ হচ্ছে...`;
    }

    try {
        const name = document.getElementById("newStudentName").value.trim();
        const rawPhone = document.getElementById("newStudentPhone").value.trim();
        const phone = normalizeDigits(rawPhone);
        const studentClass = document.getElementById("newStudentClass").value;
        const subject = document.getElementById("newStudentSubject").value.trim();
        const avatar = document.getElementById("previewStudentAvatar").src;

        const isSharedPhone = state.students.some(s => s.phone === phone);
        const newStudentId = generateNextStudentId();

        const newStudent = {
            id: newStudentId,
            name,
            phone,
            class: studentClass,
            subject,
            avatar,
            isOtpVerified: false,
            joinedAt: new Date().toISOString()
        };

        state.students.push(newStudent);
        await window.dbStorage.set("students", newStudent);

        closeModal("addStudentModal");
        renderTeacherDashboard();
        renderTeacherStudentsList();

        if (isSharedPhone) {
            showToast(`✅ একই নম্বরে যুক্ত হয়েছে! শিক্ষার্থী ${name} (ID: ${newStudentId}) যুক্ত হয়েছে।`, "success");
        } else {
            showToast(`✅ শিক্ষার্থী ${name} (ID: ${newStudentId}) সফলভাবে যুক্ত হয়েছে!`, "success");
        }
    } catch (err) {
        showToast("সংরক্ষণ ত্রুটি: " + err.message, "error");
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `<i class="fa-solid fa-check"></i> শিক্ষার্থী সংরক্ষণ করুন`;
        }
    }
}

function onSelectAssignmentToSubmit() {
    // Dropdown change callback
}

// ==========================================================================
// CREATE ASSIGNMENT (TEACHER ACTION)
// ==========================================================================
function openCreateAssignmentModal() {
    document.getElementById("createAssignmentForm").reset();
    openModal("createAssignmentModal");
}

async function handleSaveNewAssignment(event) {
    event.preventDefault();
    const saveBtn = event.target.querySelector('button[type="submit"]');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> প্রকাশ হচ্ছে...`;
    }

    try {
        const title = document.getElementById("assignTitle").value.trim();
        const type = document.getElementById("assignType").value;
        const subject = document.getElementById("assignSubject").value.trim();
        const assignClass = document.getElementById("assignClass").value;
        const deadline = document.getElementById("assignDeadline").value;
        const desc = document.getElementById("assignDesc").value.trim();

        const newAssign = {
            id: (type === 'exam' ? 'XM-' : 'HW-') + Math.floor(100 + Math.random() * 900),
            title,
            type,
            subject,
            class: assignClass,
            deadline: new Date(deadline).toISOString(),
            description: desc,
            createdAt: new Date().toISOString()
        };

        state.assignments.unshift(newAssign);
        await window.dbStorage.set("assignments", newAssign);

        addNotification({
            title: `নতুন ${type === 'exam' ? 'পরীক্ষা' : 'হোমওয়ার্ক'} যুক্ত হয়েছে!`,
            message: `${subject}: "${title}" জমা দেওয়ার শেষ তারিখ ${formatBanglaDateTime(newAssign.deadline)}।`,
            targetClass: assignClass
        });

        closeModal("createAssignmentModal");
        renderTeacherDashboard();
        renderTeacherAssignments();
        showToast("হোমওয়ার্ক / পরীক্ষা সফলভাবে প্রকাশ করা হয়েছে!", "success");
    } catch (err) {
        showToast("সমস্যা হয়েছে: " + err.message, "error");
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> প্রকাশ করুন ও শিক্ষার্থীদের জানান`;
        }
    }
}

// ==========================================================================
// DIGITAL KHATA EVALUATION CANVAS ENGINE (TEACHER ACTION)
// ==========================================================================
async function openKhataEvaluator(submissionId) {
    const sub = state.submissions.find(s => s.id === submissionId);
    if (!sub) return;

    state.currentEvaluatingSubmission = sub;
    state.currentEvaluatingPageIndex = 0;

    // Fill Header Info
    document.getElementById("evalStudentName").textContent = sub.studentName;
    document.getElementById("evalStudentAvatar").src = sub.studentAvatar;
    document.getElementById("evalAssignmentTitle").textContent = `${sub.assignmentTitle} • জমা: ${formatBanglaDateTime(sub.submittedAt)}`;

    // Setup pages count
    const totalPages = (sub.pages && sub.pages.length > 0) ? sub.pages.length : 1;
    document.getElementById("totalPagesNum").textContent = totalPages;
    document.getElementById("currentPageNum").textContent = "1";

    // Fill form values if already evaluated
    if (sub.evaluation) {
        document.getElementById("evalMarksObtained").value = sub.evaluation.obtainedMarks;
        document.getElementById("evalMarksTotal").value = sub.evaluation.totalMarks;
        document.getElementById("evalGradeSelect").value = sub.evaluation.grade;
        document.getElementById("evalTeacherRemarks").value = sub.evaluation.remarks;
    } else {
        document.getElementById("evaluationResultForm").reset();
        document.getElementById("evalMarksTotal").value = "20";
    }

    // Voice note initialization / restoration
    discardVoiceRecording();
    if (sub.evaluation && sub.evaluation.voiceNote) {
        recordedVoiceBase64 = sub.evaluation.voiceNote;
        const previewArea = document.getElementById("voicePreviewArea");
        const audioPreview = document.getElementById("evalVoiceAudioPreview");
        if (audioPreview) audioPreview.src = recordedVoiceBase64;
        if (previewArea) previewArea.style.display = "flex";
    }

    renderEvaluatorPageThumbnails();
    openModal("khataEvaluatorModal");

    // Load first page into canvas
    const imgSource = (sub.pages && sub.pages.length > 0) ? sub.pages[0] : SAMPLE_KHATA_IMAGE;
    await state.evaluator.loadImage(imgSource);
}

function renderEvaluatorPageThumbnails() {
    const strip = document.getElementById("evalPageThumbnails");
    const sub = state.currentEvaluatingSubmission;
    if (!strip || !sub || !sub.pages) return;

    if (sub.pages.length <= 1) {
        strip.style.display = "none";
        return;
    }

    strip.style.display = "flex";
    strip.innerHTML = sub.pages.map((p, i) => `
        <div class="eval-thumb-item ${i === state.currentEvaluatingPageIndex ? 'active' : ''}" onclick="jumpToKhataPage(${i})">
            <img src="${p}" alt="পৃষ্ঠা ${i+1}">
            <span class="thumb-page-badge">পৃষ্ঠা ${i+1}</span>
        </div>
    `).join('');
}

async function jumpToKhataPage(targetIndex) {
    const sub = state.currentEvaluatingSubmission;
    if (!sub || !sub.pages || targetIndex === state.currentEvaluatingPageIndex) return;
    if (targetIndex < 0 || targetIndex >= sub.pages.length) return;

    // Save current canvas annotation
    try {
        sub.pages[state.currentEvaluatingPageIndex] = state.evaluator.exportEvaluatedImage();
    } catch (e) {}

    state.currentEvaluatingPageIndex = targetIndex;
    document.getElementById("currentPageNum").textContent = (targetIndex + 1).toString();
    renderEvaluatorPageThumbnails();
    await state.evaluator.loadImage(sub.pages[targetIndex]);
}

async function navigateKhataPage(delta) {
    const sub = state.currentEvaluatingSubmission;
    if (!sub || !sub.pages) return;

    const newIndex = state.currentEvaluatingPageIndex + delta;
    if (newIndex >= 0 && newIndex < sub.pages.length) {
        await jumpToKhataPage(newIndex);
    }
}

function rotateKhataCanvas() {
    if (state.evaluator && typeof state.evaluator.rotateImage === 'function') {
        state.evaluator.rotateImage();
        showToast("খাতা ৯০° রোটেট করা হয়েছে", "info");
    }
}

function toggleCanvasFullScreen() {
    const modal = document.getElementById("khataEvaluatorModal");
    if (!modal) return;
    modal.classList.toggle("evaluator-fullscreen-active");
    if (modal.classList.contains("evaluator-fullscreen-active")) {
        showToast("ফুলস্ক্রিন মোড সক্রিয়", "info");
    }
}

function autoCalculateGrade() {
    const obInput = document.getElementById("evalMarksObtained");
    const totInput = document.getElementById("evalMarksTotal");
    const gradeSelect = document.getElementById("evalGradeSelect");

    if (!obInput || !totInput || !gradeSelect) return;
    const ob = parseFloat(obInput.value);
    const tot = parseFloat(totInput.value);

    if (isNaN(ob) || isNaN(tot) || tot <= 0) return;
    const pct = (ob / tot) * 100;

    if (pct >= 80) gradeSelect.value = "A+ (অসাধারণ)";
    else if (pct >= 70) gradeSelect.value = "A (খুব ভালো)";
    else if (pct >= 60) gradeSelect.value = "A- (ভালো)";
    else if (pct >= 50) gradeSelect.value = "B (সন্তোষজনক)";
    else if (pct >= 40) gradeSelect.value = "C (উন্নতি প্রয়োজন)";
    else gradeSelect.value = "F (পুনরায় লিখুন)";
}

function setCanvasStamp(stampType) {
    document.querySelectorAll(".tool-btn").forEach(b => b.classList.remove("active"));
    state.evaluator.currentTool = 'stamp';
    state.evaluator.currentStamp = stampType;
    showToast(`স্ট্যাম্প সক্রিয়: ${stampType}। খাতায় যেখানে ইচ্ছে ক্লিক করুন।`, "info");
}

function undoCanvas() { state.evaluator?.undo(); }
function redoCanvas() { state.evaluator?.redo(); }
function clearCanvasAnnotations() { state.evaluator?.clearAll(); }

function zoomCanvas(delta) {
    if (!state.evaluator) return;
    if (delta === 0) {
        state.evaluator.resetZoom();
    } else if (delta > 0) {
        state.evaluator.zoomIn();
    } else {
        state.evaluator.zoomOut();
    }
}
window.zoomCanvas = zoomCanvas;

function addQuickRemark(text) {
    const txtArea = document.getElementById("evalTeacherRemarks");
    if (txtArea.value) {
        txtArea.value += " " + text;
    } else {
        txtArea.value = text;
    }
}

/**
 * Save evaluation, marks, remarks and send notification to student
 */
async function handleSaveEvaluation(event) {
    if (event) event.preventDefault();
    const sub = state.currentEvaluatingSubmission;
    if (!sub) return;

    const saveBtn = document.getElementById("saveEvaluationBtn");
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> খাতা সেভ ও সিঙ্ক হচ্ছে...`;
    }

    try {
        let obtainedMarks = parseFloat(document.getElementById("evalMarksObtained").value);
        if (isNaN(obtainedMarks)) obtainedMarks = 18;

        let totalMarks = parseFloat(document.getElementById("evalMarksTotal").value);
        if (isNaN(totalMarks) || totalMarks <= 0) totalMarks = 20;

        const grade = document.getElementById("evalGradeSelect")?.value || "A (খুব ভালো)";
        const remarks = (document.getElementById("evalTeacherRemarks")?.value || "").trim() || "খাতা মূল্যায়ন সম্পন্ন হয়েছে।";

        // Capture finalized marked image from canvas
        let checkedImageBase64 = null;
        try {
            checkedImageBase64 = state.evaluator.exportEvaluatedImage();
        } catch (e) {
            checkedImageBase64 = (sub.pages && sub.pages[state.currentEvaluatingPageIndex]) ? sub.pages[state.currentEvaluatingPageIndex] : SAMPLE_KHATA_IMAGE;
        }

        if (!Array.isArray(sub.pages)) sub.pages = [checkedImageBase64];
        sub.pages[state.currentEvaluatingPageIndex] = checkedImageBase64;
        sub.evaluatedImages = [...sub.pages];

        sub.status = "checked";
        sub.evaluation = {
            obtainedMarks,
            totalMarks,
            grade,
            remarks,
            voiceNote: recordedVoiceBase64 || null,
            evaluatedAt: new Date().toISOString()
        };

        // 1. Sync in-memory state immediately
        const subIdx = state.submissions.findIndex(s => s.id === sub.id);
        if (subIdx !== -1) {
            state.submissions[subIdx] = { ...sub };
        } else {
            state.submissions.unshift({ ...sub });
        }

        // 2. Save to Database (Firestore & IndexedDB)
        try {
            await window.dbStorage.set("submissions", sub);
        } catch (err) {
            console.warn("Save submission DB notice:", err);
        }

        // 3. Create Notification for student
        const notif = {
            id: "NOTIF-" + Date.now(),
            studentId: sub.studentId,
            title: "✅ শিক্ষক আপনার খাতা মূল্যায়ন করেছেন!",
            message: `${sub.assignmentTitle} - প্রাপ্ত নম্বর: ${obtainedMarks}/${totalMarks} (${grade})। মন্তব্য: "${remarks}"`,
            timestamp: new Date().toISOString(),
            submissionId: sub.id,
            read: false
        };

        state.notifications.unshift(notif);
        try {
            await window.dbStorage.set("notifications", notif);
        } catch (e) {}

        // 4. Reset filter dropdown to show all evaluated and pending submissions clearly
        const statusFilterSelect = document.getElementById("filterSubmissionStatus");
        if (statusFilterSelect) {
            statusFilterSelect.value = "all";
        }

        closeModal("khataEvaluatorModal");
        discardVoiceRecording();
        renderTeacherDashboard();
        updateNotificationsUI();

        showToast("🎉 খাতা মূল্যায়ন সম্পন্ন এবং শিক্ষার্থীর পোর্টালে পাঠানো হয়েছে!", "success");
    } catch (err) {
        showToast("মূল্যায়ন সংরক্ষণ করতে সমস্যা হয়েছে: " + err.message, "error");
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `<i class="fa-solid fa-circle-check"></i> খাতা মূল্যায়ন সম্পন্ন ও জমা দিন`;
        }
    }
}

// ==========================================================================
// STUDENT DASHBOARD & SUBMISSION ENGINE
// ==========================================================================
function switchStudentTab(tabName) {
    document.querySelectorAll(".view-tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".student-tab-pane").forEach(p => p.style.display = "none");
    document.querySelectorAll("#studentMobileNavGroup .mobile-nav-item").forEach(b => b.classList.remove("active"));

    if (tabName === 'activeHw') {
        document.getElementById("tabStudentActiveHw")?.classList.add("active");
        document.getElementById("mobNavStudentHw")?.classList.add("active");
        const pane = document.getElementById("paneStudentActiveHw");
        if (pane) pane.style.display = "block";
        renderStudentActiveHw();
    } else if (tabName === 'mySubmissions') {
        document.getElementById("tabStudentMySubmissions")?.classList.add("active");
        document.getElementById("mobNavStudentRecords")?.classList.add("active");
        const pane = document.getElementById("paneStudentMySubmissions");
        if (pane) pane.style.display = "block";
        renderStudentHistory();
    } else if (tabName === 'leaderboard') {
        document.getElementById("tabStudentLeaderboard")?.classList.add("active");
        document.getElementById("mobNavStudentLeaderboard")?.classList.add("active");
        const pane = document.getElementById("paneStudentLeaderboard");
        if (pane) pane.style.display = "block";
        renderStudentLeaderboard();
    } else if (tabName === 'analytics') {
        document.getElementById("tabStudentAnalytics")?.classList.add("active");
        const pane = document.getElementById("paneStudentAnalytics");
        if (pane) pane.style.display = "block";
        const student = state.currentUser;
        const mySubs = state.submissions.filter(s => s.studentId === student?.id && s.status === 'checked');
        renderStudentPerformanceChart(student, mySubs);
    } else if (tabName === 'doubts') {
        document.getElementById("tabStudentDoubts")?.classList.add("active");
        const pane = document.getElementById("paneStudentDoubts");
        if (pane) pane.style.display = "block";
        renderStudentDoubts();
    } else if (tabName === 'studyMaterials') {
        document.getElementById("tabStudentStudyMaterials")?.classList.add("active");
        const pane = document.getElementById("paneStudentStudyMaterials");
        if (pane) pane.style.display = "block";
        renderStudentStudyMaterials();
    } else if (tabName === 'notices') {
        document.getElementById("tabStudentNotices")?.classList.add("active");
        const pane = document.getElementById("paneStudentNotices");
        if (pane) pane.style.display = "block";
        renderStudentNotices();
    }
}

function renderStudentLeaderboard() {
    const container = document.getElementById("studentLeaderboardList");
    if (!container) return;

    if (state.students.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2.5rem; background: white; border-radius: 14px; border: 1px dashed #cbd5e1;">
                <i class="fa-solid fa-trophy" style="font-size: 2.5rem; color: #f59e0b; margin-bottom: 10px;"></i>
                <h4>এখনো কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি</h4>
                <p style="font-size: 0.85rem; color: #64748b;">শিক্ষক শিক্ষার্থী নিবন্ধন করলে এবং খাতা দেখা শুরু হলে লিডারবোর্ড আপডেট হবে।</p>
            </div>
        `;
        return;
    }

    // Calculate score metrics for each student
    const studentRanks = state.students.map(student => {
        const studentSubs = state.submissions.filter(s => s.studentId === student.id && s.status === 'checked');
        const checkedCount = studentSubs.length;
        let avgPct = 0;
        let totalMarksSum = 0;

        if (checkedCount > 0) {
            const sumPct = studentSubs.reduce((acc, s) => {
                const ob = s.evaluation?.obtainedMarks || 0;
                const tot = s.evaluation?.totalMarks || 20;
                totalMarksSum += ob;
                return acc + (tot > 0 ? (ob / tot) * 100 : 0);
            }, 0);
            avgPct = Math.round(sumPct / checkedCount);
        }

        return {
            ...student,
            checkedCount,
            avgPct,
            totalMarksSum
        };
    });

    // Sort by avgPct descending, then checkedCount descending
    studentRanks.sort((a, b) => b.avgPct - a.avgPct || b.checkedCount - a.checkedCount);

    container.innerHTML = `
        <div class="leaderboard-grid">
            ${studentRanks.map((s, idx) => {
                const isCurrentUser = state.currentUser?.id === s.id;
                let rankBadge = `<span class="rank-num">#${idx + 1}</span>`;
                if (idx === 0) rankBadge = `<span class="rank-medal rank-medal-gold">🥇 ১ম</span>`;
                if (idx === 1) rankBadge = `<span class="rank-medal rank-medal-silver">🥈 ২য়</span>`;
                if (idx === 2) rankBadge = `<span class="rank-medal rank-medal-bronze">🥉 ৩য়</span>`;

                return `
                    <div class="leaderboard-row ${isCurrentUser ? 'current-user-row' : ''}">
                        <div class="leaderboard-left">
                            ${rankBadge}
                            <img src="${s.avatar}" class="leaderboard-avatar" alt="${s.name}">
                            <div class="leaderboard-info">
                                <div class="leaderboard-name">${s.name} ${isCurrentUser ? '<span class="you-badge">আপনি</span>' : ''}</div>
                                <div class="leaderboard-meta"><i class="fa-solid fa-school"></i> ${s.class} • ID: ${s.id}</div>
                            </div>
                        </div>
                        <div class="leaderboard-right">
                            <div class="leaderboard-stat">
                                <strong>${s.avgPct}%</strong>
                                <small>গড় স্কোর</small>
                            </div>
                            <div class="leaderboard-stat">
                                <strong>${s.checkedCount}</strong>
                                <small>যাচাইকৃত খাতা</small>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

async function renderStudentDashboard() {
    const student = state.currentUser;
    if (!student) return;

    // Refresh submissions from storage to ensure instant sync
    try {
        const storedSubs = await window.dbStorage.getAll("submissions");
        if (storedSubs && storedSubs.length > 0) {
            state.submissions = storedSubs;
        }
    } catch (e) {}

    document.getElementById("studentProfileName").textContent = student.name;
    document.getElementById("studentProfileImg").src = student.avatar;
    document.getElementById("studentProfileClass").innerHTML = `<i class="fa-solid fa-school"></i> ${student.class || 'Class 10'}`;
    document.getElementById("studentProfileSub").innerHTML = `<i class="fa-solid fa-book"></i> ${student.subject || student.group || 'বিজ্ঞান শাখা'}`;
    document.getElementById("studentProfileId").innerHTML = `<i class="fa-solid fa-id-card"></i> ID: ${student.id}`;
    document.getElementById("studentProfilePhone").innerHTML = `<i class="fa-solid fa-phone"></i> ${student.phone}`;

    // Calculate student analytics metrics
    const mySubs = state.submissions.filter(s => s.studentId === student.id);
    const totalSubs = mySubs.length;
    const checkedSubs = mySubs.filter(s => s.status === 'checked');
    const checkedCount = checkedSubs.length;

    let avgScorePercent = 0;
    if (checkedCount > 0) {
        const totalPct = checkedSubs.reduce((acc, s) => {
            const ob = s.evaluation?.obtainedMarks || 0;
            const tot = s.evaluation?.totalMarks || 20;
            return acc + (tot > 0 ? (ob / tot) * 100 : 0);
        }, 0);
        avgScorePercent = Math.round(totalPct / checkedCount);
    }

    let grade = "N/A";
    if (checkedCount > 0) {
        if (avgScorePercent >= 80) grade = "A+";
        else if (avgScorePercent >= 70) grade = "A";
        else if (avgScorePercent >= 60) grade = "A-";
        else if (avgScorePercent >= 50) grade = "B";
        else grade = "C";
    }

    const statTotalEl = document.getElementById("statStudentTotalSubmissions");
    const statCheckedEl = document.getElementById("statStudentCheckedSubmissions");
    const statAvgEl = document.getElementById("statStudentAvgScore");
    const statGradeEl = document.getElementById("statStudentGrade");

    if (statTotalEl) statTotalEl.textContent = totalSubs;
    if (statCheckedEl) statCheckedEl.textContent = checkedCount;
    if (statAvgEl) statAvgEl.textContent = checkedCount > 0 ? `${avgScorePercent}%` : "--";
    if (statGradeEl) statGradeEl.textContent = grade;

    // Calculate attendance percentage for student badge
    const studentAttRecords = state.attendance.filter(a => a.records && a.records[student.id]);
    let attPct = 100;
    if (studentAttRecords.length > 0) {
        const presentDays = studentAttRecords.filter(a => a.records[student.id] === 'present' || a.records[student.id] === 'late').length;
        attPct = Math.round((presentDays / studentAttRecords.length) * 100);
    }
    const attTag = document.getElementById("studentProfileAttendance");
    if (attTag) attTag.innerHTML = `<i class="fa-solid fa-calendar-check"></i> উপস্থিতি: ${attPct}%`;

    // Pending doubts badge
    const myDoubts = state.doubts.filter(d => d.studentId === student.id);
    const pendingDoubtsCount = myDoubts.filter(d => d.status === 'pending').length;
    const studentDoubtBadge = document.getElementById("studentPendingDoubtsCount");
    if (studentDoubtBadge) studentDoubtBadge.textContent = pendingDoubtsCount;

    renderStudentActiveHw();
    renderStudentHistory();
    updateLiveNoticeAlert();
}

function renderStudentActiveHw() {
    const grid = document.getElementById("studentAssignmentsGrid");
    const student = state.currentUser;

    const myAssignments = state.assignments.filter(a => a.class === 'All' || a.class === student.class);

    if (myAssignments.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 2.5rem 1rem; background: white; border-radius: 12px; border: 1px dashed var(--border); box-shadow: var(--shadow-sm);">
                <i class="fa-solid fa-book-open" style="font-size: 2.5rem; color: var(--primary); margin-bottom: 12px;"></i>
                <h4 style="color: #334155; margin-bottom: 6px;">সরাসরি যেকোনো খাতা জমা দিন</h4>
                <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1.25rem;">শিক্ষক কর্তৃক নির্ধারিত নির্দিষ্ট তালিকা ছাড়াও আপনি যেকোনো হোমওয়ার্ক বা পরীক্ষার খাতার ছবি সরাসরি জমা দিতে পারেন।</p>
                <button class="btn btn-primary" onclick="openSubmitHomeworkModal('GENERAL')">
                    <i class="fa-solid fa-camera"></i> খাতার ছবি জমা দিন
                </button>
            </div>
        `;
        return;
    }

    grid.innerHTML = myAssignments.map(a => {
        // Check if student already submitted this
        const alreadySub = state.submissions.find(s => s.assignmentId === a.id && s.studentId === student.id);

        return `
            <div class="assignment-card">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <span class="assign-type-badge ${a.type === 'homework' ? 'assign-type-homework' : 'assign-type-exam'}">
                            ${a.type === 'homework' ? 'ডেইলি হোমওয়ার্ক' : 'পরীক্ষার খাতা'}
                        </span>
                        <div data-deadline-countdown="${a.deadline}">
                            ${getExamCountdownHtml(a.deadline)}
                        </div>
                    </div>
                    <div class="assign-title">${a.title}</div>
                    <p style="font-size: 0.85rem; color: #475569;">${a.description || ''}</p>
                </div>
                <div>
                    <div class="assign-deadline" style="margin-bottom: 10px;">
                        <i class="fa-regular fa-clock"></i> জমা দেওয়ার শেষ সময়: ${formatBanglaDateTime(a.deadline)}
                    </div>
                    ${alreadySub ? `
                        <button class="btn btn-secondary btn-block" onclick="viewEvaluatedKhata('${alreadySub.id}')">
                            <i class="fa-solid fa-check"></i> জমা দেওয়া হয়েছে (${alreadySub.status === 'checked' ? 'ফলাফল দেখুন' : 'অপেক্ষমান'})
                        </button>
                    ` : `
                        <button class="btn btn-primary btn-block" onclick="openSubmitHomeworkModal('${a.id}')">
                            <i class="fa-solid fa-camera"></i> খাতার ছবি জমা দিন
                        </button>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

function renderStudentHistory() {
    const grid = document.getElementById("studentHistoryGrid");
    const student = state.currentUser;

    const mySubs = state.submissions.filter(s => s.studentId === student.id);
    const checkedCount = mySubs.filter(s => s.status === 'checked').length;
    document.getElementById("studentCheckedCount").textContent = checkedCount;

    if (mySubs.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 2.5rem; background: white; border-radius: 12px; border: 1px dashed #cbd5e1;">
                <i class="fa-solid fa-file-circle-question" style="font-size: 2.5rem; color: #94a3b8; margin-bottom: 10px;"></i>
                <h4>আপনি এখনো কোনো খাতা জমা দেননি</h4>
                <p style="font-size: 0.85rem;">হোমওয়ার্ক সম্পন্ন করে ছবি তুলে জমা দিন</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = mySubs.map(sub => {
        const isChecked = sub.status === 'checked';
        return `
            <div class="submission-card ${isChecked ? 'status-checked' : 'status-pending'}">
                <div class="sub-card-header">
                    <div>
                        <div class="sub-assignment-title" style="font-size: 0.95rem;">${sub.assignmentTitle}</div>
                        <div class="sub-time-meta"><i class="fa-regular fa-clock"></i> জমা: ${formatBanglaDateTime(sub.submittedAt)}</div>
                    </div>
                    <span class="badge ${isChecked ? 'badge-class' : 'badge-subject'}">
                        ${isChecked ? '✅ দেখা সম্পন্ন' : '⏳ যাচাই হচ্ছে'}
                    </span>
                </div>
                <div class="sub-card-body">
                    <div class="sub-preview-thumbnails">
                        ${sub.pages.map((p, i) => `<img src="${p}" class="sub-thumb" title="পৃষ্ঠা ${i+1}">`).join('')}
                    </div>

                    ${isChecked ? `
                        <div class="sub-evaluation-summary">
                            <span>প্রাপ্ত মার্কস: ${sub.evaluation.obtainedMarks}/${sub.evaluation.totalMarks} (${sub.evaluation.grade})</span>
                            <i class="fa-solid fa-award"></i>
                        </div>
                        <div style="font-size: 0.85rem; color: #1e293b; background: #fffbeb; padding: 8px 12px; border-radius: 6px; margin-top: 6px;">
                            <strong>শিক্ষকের মন্তব্য:</strong> "${sub.evaluation.remarks}"
                        </div>
                    ` : `
                        <div style="font-size: 0.8rem; color: #64748b; font-style: italic;">
                            শিক্ষক খাতা দেখে লাল কালিতে কেটে মার্কিং করে এখানে ফেরত পাঠাবেন।
                        </div>
                    `}
                </div>
                <div class="sub-card-footer">
                    <button class="btn ${isChecked ? 'btn-success' : 'btn-outline'} btn-block" onclick="viewEvaluatedKhata('${sub.id}')">
                        <i class="fa-solid ${isChecked ? 'fa-award' : 'fa-eye'}"></i>
                        ${isChecked ? 'দেখা খাতা ও মার্কস দেখুন' : 'জমা দেওয়া পৃষ্ঠাগুলো দেখুন'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Student Submit Homework Modal & Image Upload
function openSubmitHomeworkModal(preselectedAssignId = null) {
    state.selectedUploadImages = [];
    document.getElementById("submitHomeworkForm").reset();
    document.getElementById("khataPagesPreviewWrapper").style.display = "none";
    document.getElementById("khataPagesGrid").innerHTML = "";

    // Populate assignment dropdown
    const select = document.getElementById("submitAssignmentSelect");
    const student = state.currentUser || { class: 'Class 10' };
    const availableAssigns = state.assignments.filter(a => a.class === 'All' || a.class === student.class);

    let optionsHtml = '';
    if (availableAssigns.length > 0) {
        optionsHtml = availableAssigns.map(a => `
            <option value="${a.id}" ${a.id === preselectedAssignId ? 'selected' : ''}>
                ${a.type === 'exam' ? '📝 [পরীক্ষা]' : '📖 [হোমওয়ার্ক]'} ${a.title}
            </option>
        `).join('');
    }
    // Always include General Practice option so students can submit khata anytime
    const isGeneralSelected = (!preselectedAssignId || preselectedAssignId === 'GENERAL' || availableAssigns.length === 0);
    optionsHtml += `<option value="GENERAL" ${isGeneralSelected ? 'selected' : ''}>📝 সাধারণ অনুশীলনী / যেকোনো খাতা জমা</option>`;

    select.innerHTML = optionsHtml;
    openModal("submitHomeworkModal");
}

async function handleKhataImagesSelected(event) {
    const files = Array.from(event.target.files);
    if (!files || files.length === 0) return;

    for (const file of files) {
        const rawBase64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsDataURL(file);
        });

        // Instant Pre-compression for fast upload and lightweight memory footprint
        let optimized = rawBase64;
        if (window.freeStorage && typeof window.freeStorage.compressImage === 'function') {
            try {
                optimized = await window.freeStorage.compressImage(rawBase64, 1000, 0.72);
            } catch (err) {
                optimized = rawBase64;
            }
        }
        state.selectedUploadImages.push(optimized);
        renderUploadPagesPreview();
    }
}

function renderUploadPagesPreview() {
    const wrapper = document.getElementById("khataPagesPreviewWrapper");
    const grid = document.getElementById("khataPagesGrid");
    const badge = document.getElementById("pageCountBadge");

    if (state.selectedUploadImages.length === 0) {
        wrapper.style.display = "none";
        return;
    }

    wrapper.style.display = "block";
    badge.textContent = `${state.selectedUploadImages.length} পৃষ্ঠা`;

    grid.innerHTML = state.selectedUploadImages.map((imgSrc, idx) => `
        <div class="page-thumb-card">
            <img src="${imgSrc}" alt="পৃষ্ঠা ${idx+1}">
            <button type="button" class="delete-page-btn" onclick="removeSelectedPage(${idx})">&times;</button>
        </div>
    `).join('');
}

function removeSelectedPage(index) {
    state.selectedUploadImages.splice(index, 1);
    renderUploadPagesPreview();
}

async function handleStudentHomeworkSubmit(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    const assignSelect = document.getElementById("submitAssignmentSelect");
    const assignId = assignSelect ? assignSelect.value : "GENERAL";
    const noteEl = document.getElementById("studentSubmitNote");
    const note = noteEl ? noteEl.value.trim() : "";
    const student = state.currentUser;
    const submitBtn = document.getElementById("confirmSubmitBtn");

    let assignTitle = "সাধারণ অনুশীলনী / হোমওয়ার্ক খাতা";
    let assignType = "homework";
    const assign = state.assignments.find(a => a.id === assignId);
    if (assign) {
        assignTitle = assign.title;
        assignType = assign.type;
    }

    // Show upload progress on button & disable to prevent double submission
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ছবি প্রসেসিং ও সংরক্ষণ হচ্ছে...`;
    }

    try {
        let finalPages = [];
        if (state.selectedUploadImages.length > 0) {
            for (const rawImg of state.selectedUploadImages) {
                let compressed = rawImg;
                if (window.freeStorage && typeof window.freeStorage.compressImage === 'function') {
                    try {
                        compressed = await window.freeStorage.compressImage(rawImg, 1000, 0.72);
                    } catch (e) {
                        compressed = rawImg;
                    }
                }
                finalPages.push(compressed);
            }
        } else {
            finalPages = [SAMPLE_KHATA_IMAGE];
        }

        const newSub = {
            id: "SUB-" + Date.now(),
            studentId: student ? student.id : (state.currentUser ? state.currentUser.id : generateNextStudentId()),
            studentName: student ? student.name : (state.currentUser ? state.currentUser.name : "শিক্ষার্থী"),
            studentAvatar: student ? student.avatar : (state.currentUser ? state.currentUser.avatar : "https://api.dicebear.com/7.x/bottts/svg?seed=Student"),
            studentClass: student ? (student.class || "Class 10") : "Class 10",
            assignmentId: assign ? assign.id : "GENERAL",
            assignmentTitle: assignTitle,
            assignmentType: assignType,
            submittedAt: new Date().toISOString(),
            pages: finalPages,
            studentNote: note,
            status: "pending",
            evaluation: null
        };

        state.submissions.unshift(newSub);
        await window.dbStorage.set("submissions", newSub);

        // Notify Teacher
        addNotification({
            title: `নতুন খাতা জমা: ${newSub.studentName}`,
            message: `${newSub.studentName} (${newSub.studentClass}) "${assignTitle}" এর খাতা জমা দিয়েছে।`,
            targetRole: "teacher"
        });

        closeModal("submitHomeworkModal");
        renderStudentDashboard();
        showToast("🎉 আপনার খাতা সফলভাবে জমা হয়েছে!", "success");
    } catch (err) {
        console.error("Submission failed:", err);
        showToast("খাতা জমা দিতে সমস্যা হয়েছে, অনুগ্রহ করে আবার চেষ্টা করুন।", "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<i class="fa-solid fa-check-double"></i> খাতা জমা দিন`;
    }
}

/**
 * Student View Evaluated Khata Modal
 */
function viewEvaluatedKhata(submissionId) {
    const sub = state.submissions.find(s => s.id === submissionId);
    if (!sub) return;

    document.getElementById("viewKhataTitle").innerHTML = `<i class="fa-solid fa-award"></i> ${sub.assignmentTitle}`;
    document.getElementById("viewKhataSubtitle").textContent = `শিক্ষার্থী: ${sub.studentName} • জমা: ${formatBanglaDateTime(sub.submittedAt)}`;

    if (sub.evaluation) {
        document.getElementById("viewScoreObtained").textContent = sub.evaluation.obtainedMarks;
        document.getElementById("viewScoreTotal").textContent = sub.evaluation.totalMarks;
        document.getElementById("viewScoreGrade").textContent = sub.evaluation.grade;
        document.getElementById("viewTeacherRemarksText").textContent = sub.evaluation.remarks;
        document.getElementById("viewEvaluatedDate").textContent = `মূল্যায়নের সময়: ${formatBanglaDateTime(sub.evaluation.evaluatedAt)}`;
    } else {
        document.getElementById("viewScoreObtained").textContent = "--";
        document.getElementById("viewScoreTotal").textContent = "--";
        document.getElementById("viewScoreGrade").textContent = "অপেক্ষমান";
        document.getElementById("viewTeacherRemarksText").textContent = "শিক্ষক এখনো খাতা মূল্যায়ন করেননি। অনুগ্রহ করে অপেক্ষা করুন।";
        document.getElementById("viewEvaluatedDate").textContent = "এখনো দেখা হয়নি";
    }

    const imagesList = document.getElementById("viewCheckedImagesList");
    const displayImages = sub.evaluatedImages || sub.pages || [SAMPLE_KHATA_IMAGE];

    imagesList.innerHTML = displayImages.map((imgSrc, i) => `
        <div style="text-align: center;">
            <span style="font-weight: 600; font-size: 0.85rem; color: #475569; display: block; margin-bottom: 6px;">পৃষ্ঠা ${i+1}:</span>
            <img src="${imgSrc}" class="checked-khata-img" alt="Evaluated Page ${i+1}">
        </div>
    `).join('');

    window.currentViewedKhataImage = displayImages[0];
    window.currentViewedKhataSub = sub;

    // Evaluated Voice Note Playback
    const voiceBox = document.getElementById("viewEvaluatedVoiceBox");
    const voiceAudio = document.getElementById("viewEvaluatedVoiceAudio");
    if (sub.evaluation && sub.evaluation.voiceNote) {
        if (voiceAudio) voiceAudio.src = sub.evaluation.voiceNote;
        if (voiceBox) voiceBox.style.display = "block";
    } else {
        if (voiceAudio) voiceAudio.src = "";
        if (voiceBox) voiceBox.style.display = "none";
    }

    openModal("viewEvaluatedKhataModal");
}

function downloadEvaluatedKhata() {
    if (window.currentViewedKhataImage) {
        const link = document.createElement("a");
        link.download = `evaluated-khata-${Date.now()}.jpg`;
        link.href = window.currentViewedKhataImage;
        link.click();
        showToast("খাতা ডাউনলোড হচ্ছে...", "info");
    }
}

// ==========================================================================
// NOTIFICATIONS ENGINE
// ==========================================================================
async function addNotification(notifData) {
    const notif = {
        id: "NOTIF-" + Date.now(),
        timestamp: new Date().toISOString(),
        read: false,
        ...notifData
    };
    state.notifications.unshift(notif);
    await window.dbStorage.set("notifications", notif);
    updateNotificationsUI();
}

function updateNotificationsUI() {
    const badge = document.getElementById("notifBadge");
    const list = document.getElementById("notifList");
    const clearBtn = document.getElementById("clearNotifsBtn");

    if (!list) return;

    // Filter relevant notifications
    const relevant = state.notifications.filter(n => {
        if (!state.currentUser) return false;
        if (state.currentUser.role === 'teacher') return true;
        return !n.studentId || n.studentId === state.currentUser.id;
    });

    const unread = relevant.filter(n => !n.read).length;
    if (badge) {
        badge.textContent = unread.toString();
        badge.style.display = unread > 0 ? "flex" : "none";
    }

    if (relevant.length === 0) {
        list.innerHTML = `<div class="empty-notif">কোনো নতুন নোটিফিকেশন নেই</div>`;
        return;
    }

    list.innerHTML = relevant.map(n => `
        <div class="notif-item ${!n.read ? 'unread' : ''}">
            <div class="notif-item-title"><i class="fa-solid fa-bell" style="color: #4f46e5;"></i> ${n.title}</div>
            <p style="font-size: 0.8rem; margin-top: 2px;">${n.message}</p>
            <div class="notif-item-time">${formatBanglaDateTime(n.timestamp)}</div>
        </div>
    `).join('');

    clearBtn.onclick = async () => {
        state.notifications = [];
        list.innerHTML = `<div class="empty-notif">সকল নোটিফিকেশন মুছে ফেলা হয়েছে</div>`;
        if (badge) badge.style.display = "none";
    };
}

// ==========================================================================
// MODAL & HELPER UTILITIES
// ==========================================================================
function openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) {
        el.classList.add("show");
        document.body.classList.add("modal-open");
    }
}

function closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) {
        el.classList.remove("show");
    }
    // Only remove modal-open class if no other modal is currently visible
    if (!document.querySelector(".modal-overlay.show")) {
        document.body.classList.remove("modal-open");
    }
}

function renderAllViews() {
    applyAuthStateUI();
}

function formatBanglaDateTime(isoString) {
    if (!isoString) return "--";
    const date = new Date(isoString);
    const options = { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true };
    return date.toLocaleString('bn-BD', options);
}

function showToast(text, type = "info") {
    let bg = "linear-gradient(to right, #4f46e5, #6366f1)";
    if (type === "success") bg = "linear-gradient(to right, #10b981, #059669)";
    if (type === "error") bg = "linear-gradient(to right, #ef4444, #dc2626)";
    if (type === "warning") bg = "linear-gradient(to right, #f59e0b, #d97706)";

    if (typeof Toastify !== 'undefined') {
        Toastify({
            text: text,
            duration: 4000,
            close: true,
            gravity: "top",
            position: "right",
            style: {
                background: bg,
                borderRadius: "10px",
                fontWeight: "600",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)"
            }
        }).showToast();
    }
}

// ==========================================================================
// EXAM LIVE COUNTDOWN TIMER ENGINE
// ==========================================================================
function getExamCountdownHtml(deadline) {
    if (!deadline) return '';
    const now = new Date().getTime();
    const target = new Date(deadline).getTime();
    const diff = target - now;

    if (diff <= 0) {
        return `<span class="countdown-badge countdown-expired"><i class="fa-solid fa-circle-exclamation"></i> সময় শেষ</span>`;
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const secs = Math.floor((diff % (1000 * 60)) / 1000);

    const isUrgent = diff < 1000 * 60 * 60 * 2; // < 2 hours
    const badgeClass = isUrgent ? 'countdown-urgent' : 'countdown-running';

    let timeStr = '';
    if (hours > 24) {
        const days = Math.floor(hours / 24);
        timeStr = `${days} দিন ${hours % 24} ঘণ্টা বাকি`;
    } else {
        timeStr = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    return `<span class="countdown-badge ${badgeClass}"><i class="fa-solid fa-stopwatch"></i> ${timeStr}</span>`;
}

function initExamCountdownTicking() {
    if (window._examCountdownInterval) clearInterval(window._examCountdownInterval);
    window._examCountdownInterval = setInterval(() => {
        document.querySelectorAll('[data-deadline-countdown]').forEach(el => {
            const dl = el.getAttribute('data-deadline-countdown');
            if (dl) {
                el.innerHTML = getExamCountdownHtml(dl);
            }
        });
    }, 1000);
}

// ==========================================================================
// OMR SHEET EVALUATOR & MCQ AUTO-GRADER
// ==========================================================================
window.omrState = {
    mode: 'key', // 'key' or 'student'
    totalQuestions: 20,
    negativeMark: 0.25,
    answerKey: {},   // { 1: 'B', 2: 'A', ... }
    studentAnswers: {} // { 1: 'B', 2: 'C', ... }
};

function openOmrModal() {
    initOmrGrid();
    openModal("omrEvaluatorModal");
}

function setOmrMode(mode) {
    window.omrState.mode = mode;
    const keyBtn = document.getElementById("omrModeAnswerKeyBtn");
    const stuBtn = document.getElementById("omrModeStudentBtn");

    if (mode === 'key') {
        if (keyBtn) keyBtn.className = "btn btn-sm btn-primary";
        if (stuBtn) stuBtn.className = "btn btn-sm btn-outline";
    } else {
        if (keyBtn) keyBtn.className = "btn btn-sm btn-outline";
        if (stuBtn) stuBtn.className = "btn btn-sm btn-primary";
    }
    renderOmrBubblesUI();
}

function initOmrGrid() {
    const totalSelect = document.getElementById("omrTotalQuestions");
    if (totalSelect) {
        window.omrState.totalQuestions = parseInt(totalSelect.value, 10) || 20;
    }
    renderOmrBubblesUI();
    calculateOmrScore();
}

function renderOmrBubblesUI() {
    const gridWrapper = document.getElementById("omrGridWrapper");
    if (!gridWrapper) return;

    const total = window.omrState.totalQuestions;
    const options = ['A', 'B', 'C', 'D'];
    const mode = window.omrState.mode;

    let html = '';
    for (let q = 1; q <= total; q++) {
        const keyAns = window.omrState.answerKey[q];
        const stuAns = window.omrState.studentAnswers[q];

        html += `
            <div class="omr-q-row">
                <span class="omr-q-num">Q${q}</span>
                <div class="omr-bubbles-group">
        `;

        options.forEach(opt => {
            let bubbleClass = 'omr-bubble';
            if (mode === 'key') {
                if (keyAns === opt) bubbleClass += ' selected';
            } else {
                // In student mode, show whether correct/wrong if key is set
                if (stuAns === opt) {
                    if (keyAns) {
                        bubbleClass += (stuAns === keyAns) ? ' correct' : ' wrong';
                    } else {
                        bubbleClass += ' selected';
                    }
                } else if (keyAns === opt) {
                    bubbleClass += ' key-hint';
                }
            }

            html += `
                <button type="button" class="${bubbleClass}" onclick="handleOmrBubbleClick(${q}, '${opt}')">
                    ${opt}
                </button>
            `;
        });

        html += `
                </div>
            </div>
        `;
    }

    gridWrapper.innerHTML = html;
}

function handleOmrBubbleClick(qNum, option) {
    if (window.omrState.mode === 'key') {
        if (window.omrState.answerKey[qNum] === option) {
            delete window.omrState.answerKey[qNum];
        } else {
            window.omrState.answerKey[qNum] = option;
        }
    } else {
        if (window.omrState.studentAnswers[qNum] === option) {
            delete window.omrState.studentAnswers[qNum];
        } else {
            window.omrState.studentAnswers[qNum] = option;
        }
    }

    renderOmrBubblesUI();
    calculateOmrScore();
}

function calculateOmrScore() {
    const negSelect = document.getElementById("omrNegativeMark");
    const neg = negSelect ? parseFloat(negSelect.value) : 0.25;
    window.omrState.negativeMark = neg;

    const total = window.omrState.totalQuestions;
    let correct = 0;
    let wrong = 0;
    let unattempted = 0;

    for (let q = 1; q <= total; q++) {
        const key = window.omrState.answerKey[q];
        const stu = window.omrState.studentAnswers[q];

        if (!stu) {
            unattempted++;
        } else if (key) {
            if (stu === key) {
                correct++;
            } else {
                wrong++;
            }
        } else {
            correct++;
        }
    }

    const rawScore = correct * 1 - (wrong * neg);
    const totalScore = Math.max(0, parseFloat(rawScore.toFixed(2)));
    const pct = total > 0 ? Math.round((totalScore / total) * 100) : 0;

    let grade = 'F';
    if (pct >= 80) grade = 'A+';
    else if (pct >= 70) grade = 'A';
    else if (pct >= 60) grade = 'A-';
    else if (pct >= 50) grade = 'B';
    else if (pct >= 40) grade = 'C';
    else if (pct >= 33) grade = 'D';

    const elCorrect = document.getElementById("omrStatCorrect");
    const elWrong = document.getElementById("omrStatWrong");
    const elUnatt = document.getElementById("omrStatUnattempted");
    const elScore = document.getElementById("omrStatTotalScore");
    const elGrade = document.getElementById("omrStatGrade");

    if (elCorrect) elCorrect.textContent = correct;
    if (elWrong) elWrong.textContent = wrong;
    if (elUnatt) elUnatt.textContent = unattempted;
    if (elScore) elScore.textContent = totalScore.toFixed(2);
    if (elGrade) elGrade.textContent = `${grade} (${pct}%)`;

    window.omrState.calculated = {
        correct, wrong, unattempted, totalScore, total, grade, pct
    };
}

function resetOmrGrid() {
    if (window.omrState.mode === 'key') {
        window.omrState.answerKey = {};
    } else {
        window.omrState.studentAnswers = {};
    }
    renderOmrBubblesUI();
    calculateOmrScore();
    showToast("OMR উত্তরপত্র রিসেট করা হয়েছে", "info");
}

function applyOmrScoreToKhata() {
    const calc = window.omrState.calculated;
    if (!calc) {
        showToast("প্রথমে OMR মূল্যায়ন সম্পন্ন করুন!", "warning");
        return;
    }

    const marksInput = document.getElementById("evalMarksInput");
    const totalInput = document.getElementById("evalTotalInput");
    const remarksInput = document.getElementById("evalRemarksInput");

    if (marksInput) marksInput.value = calc.totalScore;
    if (totalInput) totalInput.value = calc.total;
    if (remarksInput) {
        remarksInput.value = `MCQ OMR মূল্যায়ন: সঠিক ${calc.correct}, ভুল ${calc.wrong}, প্রাপ্ত নম্বর: ${calc.totalScore}/${calc.total} (${calc.grade})`;
    }

    closeModal("omrEvaluatorModal");
    showToast(`✅ OMR নম্বর (${calc.totalScore}/${calc.total}) মূল্যায়ন প্যানেলে যুক্ত করা হয়েছে!`, "success");
}

// ==========================================================================
// DATABASE CLEAN / RESET CONTROLLER
// ==========================================================================
async function promptResetDatabase() {
    const confirmWipe = confirm("⚠️ আপনি কি নিশ্চিত যে ক্লাউড ও লোকাল ডেটাবেসের সমস্ত টেস্ট ডাটা, খাতা, পরীক্ষা ও শিক্ষার্থী চিরতরে মুছে ফেলে একদম নতুন ডেটাবেস করতে চান?\n\nএটি পূর্বাবস্থায় ফিরিয়ে আনা যাবে না!");
    if (!confirmWipe) return;

    try {
        // Clear all states
        state.students = [];
        state.assignments = [];
        state.submissions = [];
        state.notifications = [];

        // Purge completely from local IndexedDB and Cloud Firestore
        if (window.dbStorage && typeof window.dbStorage.purgeAllDataPermanently === 'function') {
            await window.dbStorage.purgeAllDataPermanently();
        }

        renderTeacherDashboard();
        renderTeacherStudentsList();
        renderTeacherAssignments();
        showToast("✨ সমস্ত ডেটাবেস চিরতরে পার্মানেন্টলি মুছে ফেলা হয়েছে (একদম নতুন ফ্রেশ ডেটাবেস)!", "success");
    } catch (err) {
        console.error("Reset error:", err);
        showToast("ডাটাবেস রিসেট সম্পন্ন হয়েছে", "info");
    }
}

// ==========================================================================
// VOICE NOTE RECORDER ENGINE (FOR TEACHER KHATA FEEDBACK)
// ==========================================================================
let voiceMediaRecorder = null;
let recordedAudioChunks = [];
let recordedVoiceBase64 = null;
let voiceRecordTimerInterval = null;
let voiceRecordSeconds = 0;

async function toggleVoiceRecording() {
    const btn = document.getElementById("startVoiceRecordBtn");
    const timer = document.getElementById("voiceRecordTimer");
    const previewArea = document.getElementById("voicePreviewArea");
    const audioPreview = document.getElementById("evalVoiceAudioPreview");

    // If already recording, stop it
    if (voiceMediaRecorder && voiceMediaRecorder.state === "recording") {
        voiceMediaRecorder.stop();
        if (voiceRecordTimerInterval) clearInterval(voiceRecordTimerInterval);
        if (btn) {
            btn.innerHTML = `<i class="fa-solid fa-microphone-lines"></i> <span>নতুন করে রেকর্ড করুন</span>`;
            btn.classList.remove("btn-danger");
            btn.classList.add("btn-outline");
        }
        if (timer) timer.style.display = "none";
        return;
    }

    // Start recording
    try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showToast("আপনার ব্রাউজারে অডিও রেকর্ডিং সাপোর্ট নেই", "warning");
            return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recordedAudioChunks = [];
        voiceMediaRecorder = new MediaRecorder(stream);

        voiceMediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                recordedAudioChunks.push(event.data);
            }
        };

        voiceMediaRecorder.onstop = () => {
            stream.getTracks().forEach(t => t.stop());
            const audioBlob = new Blob(recordedAudioChunks, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.onloadend = () => {
                recordedVoiceBase64 = reader.result;
                if (audioPreview) {
                    audioPreview.src = recordedVoiceBase64;
                    if (previewArea) previewArea.style.display = "flex";
                }
                showToast("🎙️ অডিও ভয়েস নোট রেকর্ড সম্পন্ন হয়েছে", "success");
            };
            reader.readAsDataURL(audioBlob);
        };

        voiceMediaRecorder.start();
        voiceRecordSeconds = 0;
        if (timer) {
            timer.style.display = "inline-block";
            timer.textContent = "🔴 0:00";
        }

        voiceRecordTimerInterval = setInterval(() => {
            voiceRecordSeconds++;
            const mins = Math.floor(voiceRecordSeconds / 60);
            const secs = voiceRecordSeconds % 60;
            if (timer) {
                timer.textContent = `🔴 ${mins}:${secs < 10 ? '0' : ''}${secs}`;
            }
            if (voiceRecordSeconds >= 180) { // 3 min max
                toggleVoiceRecording();
            }
        }, 1000);

        if (btn) {
            btn.innerHTML = `<i class="fa-solid fa-stop"></i> <span>রেকর্ডিং বন্ধ করুন</span>`;
            btn.classList.remove("btn-outline");
            btn.classList.add("btn-danger");
        }
        if (previewArea) previewArea.style.display = "none";
    } catch (err) {
        console.error("Microphone access error:", err);
        showToast("মাইক্রোফোনের অনুমতি দেওয়া হয়নি বা কোনো মাইক্রোফোন পাওয়া যায়নি", "error");
    }
}

function discardVoiceRecording() {
    try {
        if (voiceMediaRecorder && voiceMediaRecorder.state === "recording") {
            voiceMediaRecorder.stop();
        }
    } catch (e) {}
    if (voiceRecordTimerInterval) clearInterval(voiceRecordTimerInterval);
    recordedAudioChunks = [];
    recordedVoiceBase64 = null;

    const btn = document.getElementById("startVoiceRecordBtn");
    const timer = document.getElementById("voiceRecordTimer");
    const previewArea = document.getElementById("voicePreviewArea");
    const audioPreview = document.getElementById("evalVoiceAudioPreview");

    if (btn) {
        btn.innerHTML = `<i class="fa-solid fa-microphone-lines"></i> <span>ভয়েস রেকর্ড করুন</span>`;
        btn.classList.remove("btn-danger");
        btn.classList.add("btn-outline");
    }
    if (timer) timer.style.display = "none";
    if (audioPreview) audioPreview.src = "";
    if (previewArea) previewArea.style.display = "none";
}

// ==========================================================================
// AI DRAFT FEEDBACK GENERATOR
// ==========================================================================
function generateAiKhataFeedback() {
    const obInput = document.getElementById("evalMarksObtained");
    const totInput = document.getElementById("evalMarksTotal");
    const remarksText = document.getElementById("evalTeacherRemarks");

    const ob = parseFloat(obInput?.value) || 0;
    const tot = parseFloat(totInput?.value) || 20;
    const pct = tot > 0 ? (ob / tot) * 100 : 80;

    let suggestions = [];
    if (pct >= 85) {
        suggestions = [
            "অসাধারণ উত্তর! প্রতিটি ধাপ নির্ভুল ও পরিচ্ছন্ন। এই সুন্দর ধারাবাহিকতা বজায় রেখো।",
            "চমৎকার হয়েছে! হাতের লেখা ও উপস্থাপন উভয়ই বেশ প্রশংসনীয়। শুভকামনা রইল!",
            "পারফেক্ট কাজ! সবগুলো উত্তর যথাযথ হয়েছে। আরও এগিয়ে যাও।"
        ];
    } else if (pct >= 70) {
        suggestions = [
            "খুব ভালো প্রচেষ্টা! অধিকাংশ উত্তর সঠিক হয়েছে, তবে ছোটখাটো কিছু জায়গায় আরেকটু সতর্ক থাকতে হবে।",
            "ভালো লিখেছ। সূত্রের প্রয়োগ ঠিক ছিল, গণনার শেষ অংশটি আরেকটু সাবধানে মিলিয়ে নিও।",
            "সুন্দর কাজ! নিয়মিত এমন অধ্যবসায় রাখলে পরবর্তী পরীক্ষায় আরও দারুণ ফলাফল সম্ভব।"
        ];
    } else if (pct >= 50) {
        suggestions = [
            "সন্তোষজনক হয়েছে। তবে মূল পয়েন্টগুলো আরেকটু গভীরভাবে রিভিশন দেওয়া প্রয়োজন।",
            "প্রচেষ্টা ভালো ছিল, কিন্তু কিছু মৌলিক জায়গায় ভুল হয়েছে। লাল কালির মার্কিংগুলো ভালো করে দেখে নাও।",
            "আরেকটু যত্নশীল হতে হবে। চিহ্নিত ভুলগুলো সংশোধন করে বারবার চর্চা করো।"
        ];
    } else {
        suggestions = [
            "অনেক বেশি মনোযোগ ও অনুশীলন প্রয়োজন। যে প্রশ্নগুলোতে ভুল হয়েছে সেগুলো পুনরায় নোট করে নাও।",
            "পড়াশোনায় সময় আরও বাড়াতে হবে। মূল কনসেপ্টগুলো আবার পড়ে প্রয়োজনে ক্লাসে আলোচনা করে নিও।",
            "হতাশ হওয়ার কিছু নেই, নিয়মিত রিভিশন ও অধ্যবসায়ের মাধ্যমে নিশ্চয়ই ভালো করতে পারবে।"
        ];
    }

    const picked = suggestions[Math.floor(Math.random() * suggestions.length)];
    if (remarksText) {
        remarksText.value = picked;
        remarksText.focus();
        showToast("✨ AI ড্রাফট মন্তব্য যুক্ত হয়েছে", "success");
    }
}

// ==========================================================================
// WHATSAPP RESULT & REPORT NOTIFICATIONS
// ==========================================================================
function formatKhataWhatsAppMessage(sub) {
    const ob = sub.evaluation?.obtainedMarks || 0;
    const tot = sub.evaluation?.totalMarks || 20;
    const grade = sub.evaluation?.grade || "A";
    const remarks = sub.evaluation?.remarks || "খাতা মূল্যায়ন সম্পন্ন হয়েছে।";
    const creds = getAuthorizedTeacherCredentials();
    const teacherName = creds.name || "আফিক স্যার";

    return `*EduCheck ডিজিটাল একাডেমি - খাতা মূল্যায়নের ফলাফল* 📝\n\n` +
           `👤 *শিক্ষার্থীর নাম:* ${sub.studentName}\n` +
           `🆔 *আইডি:* ${sub.studentId}\n` +
           `📚 *বিষয় / পরীক্ষা:* ${sub.assignmentTitle}\n` +
           `📊 *প্রাপ্ত নম্বর:* ${ob} / ${tot} (${grade})\n` +
           `💬 *শিক্ষকের মূল্যায়ন:* "${remarks}"\n` +
           `👨‍🏫 *মূল্যায়নকারী শিক্ষক:* ${teacherName}\n\n` +
           `EduCheck ডিজিটাল পোর্টালে লগইন করে লাল কালির মূল্যায়িত খাতা ও শিক্ষকের অডিও ভয়েস নোট দেখতে পারবেন। ধন্যবাদ!`;
}

function sendWhatsAppKhataResult(subId) {
    const sub = state.submissions.find(s => s.id === subId) || window.currentViewedKhataSub;
    if (!sub || !sub.evaluation) {
        showToast("খাতাটি এখনো মূল্যায়ন করা হয়নি", "warning");
        return;
    }

    const msg = formatKhataWhatsAppMessage(sub);
    const encoded = encodeURIComponent(msg);
    let phone = (sub.studentPhone || "").replace(/[^0-9]/g, "");
    if (phone.startsWith("0")) phone = "880" + phone.slice(1);

    const waUrl = phone.length >= 10 ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(waUrl, "_blank");
    showToast("WhatsApp এ ফলাফল ওপেন হচ্ছে...", "info");
}

function shareEvaluatedKhataWhatsApp() {
    if (window.currentViewedKhataSub) {
        sendWhatsAppKhataResult(window.currentViewedKhataSub.id);
    } else {
        showToast("কোনো মূল্যায়িত খাতা পাওয়া যায়নি", "warning");
    }
}

function sendReportCardWhatsApp() {
    const student = window.currentReportCardStudent || (state.currentUser?.role === 'student' ? state.currentUser : null);
    if (!student) {
        showToast("শিক্ষার্থীর তথ্য পাওয়া যায়নি", "warning");
        return;
    }

    const studentSubs = state.submissions.filter(s => s.studentId === student.id);
    const checkedSubs = studentSubs.filter(s => s.status === 'checked');
    const checkedCount = checkedSubs.length;

    let avgScorePercent = 0;
    if (checkedCount > 0) {
        const totalPct = checkedSubs.reduce((acc, s) => {
            const ob = s.evaluation?.obtainedMarks || 0;
            const tot = s.evaluation?.totalMarks || 20;
            return acc + (tot > 0 ? (ob / tot) * 100 : 0);
        }, 0);
        avgScorePercent = Math.round(totalPct / checkedCount);
    }

    let grade = "N/A";
    if (checkedCount > 0) {
        if (avgScorePercent >= 80) grade = "A+ (অসাধারণ)";
        else if (avgScorePercent >= 70) grade = "A (খুব ভালো)";
        else if (avgScorePercent >= 60) grade = "A- (ভালো)";
        else if (avgScorePercent >= 50) grade = "B (সন্তোষজনক)";
        else grade = "C (উন্নতি প্রয়োজন)";
    }

    const creds = getAuthorizedTeacherCredentials();
    const teacherName = creds.name || "আফিক স্যার";

    const msg = `🎓 *EduCheck ডিজিটাল একাডেমি - শিক্ষার্থী অগ্রগতি রিপোর্ট* 📄\n\n` +
        `👤 *শিক্ষার্থীর নাম:* ${student.name}\n` +
        `🆔 *আইডি:* ${student.id} | *শ্রেণি:* ${student.class || 'Class 10'} (${student.subject || 'বিজ্ঞান'})\n` +
        `-----------------------------------------\n` +
        `📋 *মোট জমা খাতা:* ${studentSubs.length} টি\n` +
        `✅ *মূল্যায়িত খাতা:* ${checkedCount} টি\n` +
        `📈 *গড় প্রাপ্ত স্কোর:* ${checkedCount > 0 ? avgScorePercent + '%' : 'N/A'}\n` +
        `🏅 *সামগ্রিক গ্রেড:* ${grade}\n` +
        `-----------------------------------------\n` +
        `👨‍🏫 *নির্দেশক ও মূল্যায়নকারী:* ${teacherName}\n\n` +
        `নিয়মিত হোমওয়ার্ক ও পরীক্ষার বিস্তারিত খাতা দেখতে EduCheck অ্যাপে লগইন করুন। ধন্যবাদ!`;

    const encoded = encodeURIComponent(msg);
    let phone = (student.phone || "").replace(/[^0-9]/g, "");
    if (phone.startsWith("0")) phone = "880" + phone.slice(1);

    const waUrl = phone.length >= 10 ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(waUrl, "_blank");
    showToast("হোয়াটসঅ্যাপে মার্কশিট রিপোর্ট পাঠানো হচ্ছে...", "info");
}

// ==========================================================================
// STUDENT REPORT CARD & MARKSHEET MODAL CONTROLLER
// ==========================================================================
function openStudentReportCardModal(studentId) {
    let student = null;
    if (studentId) {
        student = state.students.find(s => s.id === studentId);
        if (!student) {
            const anySub = state.submissions.find(s => s.studentId === studentId);
            if (anySub) {
                student = {
                    id: anySub.studentId,
                    name: anySub.studentName,
                    phone: anySub.studentPhone || "--",
                    class: anySub.studentClass || "Class 10",
                    subject: anySub.subject || "বিজ্ঞান"
                };
            }
        }
    } else if (state.currentUser && state.currentUser.role === 'student') {
        student = state.currentUser;
    }

    if (!student) {
        showToast("শিক্ষার্থীর তথ্য পাওয়া যায়নি", "warning");
        return;
    }

    window.currentReportCardStudent = student;

    // Set Header & Meta
    document.getElementById("reportStudentName").textContent = student.name;
    document.getElementById("reportStudentId").textContent = student.id;
    document.getElementById("reportStudentClass").textContent = `${student.class || 'Class 10'} (${student.subject || student.group || 'বিজ্ঞান'})`;
    document.getElementById("reportStudentPhone").textContent = student.phone || "--";

    const creds = getAuthorizedTeacherCredentials();
    const stampEl = document.getElementById("reportTeacherStamp");
    if (stampEl) {
        stampEl.innerHTML = `${creds.name || 'আফিক স্যার'}<br><small>প্রধান শিক্ষক ও নির্দেশক</small>`;
    }

    // Filter submissions for this student
    const studentSubs = state.submissions.filter(s => s.studentId === student.id);
    const checkedSubs = studentSubs.filter(s => s.status === 'checked');
    const checkedCount = checkedSubs.length;

    let avgScorePercent = 0;
    if (checkedCount > 0) {
        const totalPct = checkedSubs.reduce((acc, s) => {
            const ob = s.evaluation?.obtainedMarks || 0;
            const tot = s.evaluation?.totalMarks || 20;
            return acc + (tot > 0 ? (ob / tot) * 100 : 0);
        }, 0);
        avgScorePercent = Math.round(totalPct / checkedCount);
    }

    let finalGrade = "N/A";
    if (checkedCount > 0) {
        if (avgScorePercent >= 80) finalGrade = "A+";
        else if (avgScorePercent >= 70) finalGrade = "A";
        else if (avgScorePercent >= 60) finalGrade = "A-";
        else if (avgScorePercent >= 50) finalGrade = "B";
        else finalGrade = "C";
    }

    document.getElementById("reportTotalHw").textContent = studentSubs.length;
    document.getElementById("reportCheckedHw").textContent = checkedCount;
    document.getElementById("reportAvgScore").textContent = checkedCount > 0 ? `${avgScorePercent}%` : "--";
    document.getElementById("reportFinalGrade").textContent = finalGrade;

    // Render Submissions Table
    const tbody = document.getElementById("reportKhataTableBody");
    if (studentSubs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: #64748b; padding: 1.5rem;">
                    এখনো কোনো খাতা বা হোমওয়ার্ক জমা দেওয়া হয়নি
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = studentSubs.map(s => {
            const dt = formatBanglaDateTime(s.submittedAt);
            const isChecked = s.status === 'checked';
            const marksText = isChecked ? `${s.evaluation.obtainedMarks} / ${s.evaluation.totalMarks}` : `<span style="color: #94a3b8;">--</span>`;
            const gradeBadge = isChecked ? `<span class="badge badge-success" style="font-size: 0.76rem;">${s.evaluation.grade}</span>` : `<span class="badge badge-warning" style="font-size: 0.76rem;">অপেক্ষমান</span>`;
            const remarksText = isChecked ? (s.evaluation.remarks || 'মূল্যায়ন সম্পন্ন') : 'শিক্ষকের মূল্যায়ন প্রক্রিয়াধীন';

            return `
                <tr>
                    <td style="font-size: 0.82rem; white-space: nowrap;">${dt}</td>
                    <td><strong>${s.assignmentTitle}</strong></td>
                    <td>${s.subject || student.subject || 'সাধারণ'}</td>
                    <td style="text-align: center; font-weight: bold;">${marksText}</td>
                    <td style="text-align: center;">${gradeBadge}</td>
                    <td style="font-size: 0.82rem; color: #475569;">${remarksText}</td>
                </tr>
            `;
        }).join('');
    }

    openModal("studentReportCardModal");
}

// ==========================================================================
// STUDENT BADGES & ACHIEVEMENTS SYSTEM
// ==========================================================================
function renderStudentBadges(student, totalSubs, checkedCount, avgScorePercent, checkedSubs) {
    // Badges UI deactivated per request
}

// ==========================================================================
// TEACHER SETTINGS & PASSWORD CHANGE CONTROLLER
// ==========================================================================
function openTeacherSettingsModal() {
    const creds = getAuthorizedTeacherCredentials();
    const nameInput = document.getElementById("teacherSettingsName");
    const emailInput = document.getElementById("teacherSettingsEmail");
    const currentPassInput = document.getElementById("teacherSettingsCurrentPass");
    const newPassInput = document.getElementById("teacherSettingsNewPass");
    const confirmPassInput = document.getElementById("teacherSettingsConfirmPass");

    if (nameInput) nameInput.value = creds.name || "আফিক স্যার";
    if (emailInput) emailInput.value = creds.emails[0] || "teacher@gmail.com";
    if (currentPassInput) currentPassInput.value = "";
    if (newPassInput) newPassInput.value = "";
    if (confirmPassInput) confirmPassInput.value = "";

    openModal("teacherSettingsModal");
}

function handleSaveTeacherSettings(event) {
    if (event) event.preventDefault();
    const creds = getAuthorizedTeacherCredentials();
    const name = (document.getElementById("teacherSettingsName")?.value || "").trim();
    const email = (document.getElementById("teacherSettingsEmail")?.value || "").trim().toLowerCase();
    const currentPass = document.getElementById("teacherSettingsCurrentPass")?.value || "";
    const newPass = document.getElementById("teacherSettingsNewPass")?.value || "";
    const confirmPass = document.getElementById("teacherSettingsConfirmPass")?.value || "";

    if (!name) {
        showToast("শিক্ষকের নাম লিখুন", "warning");
        return;
    }
    if (!email) {
        showToast("লগইন জিমেইল প্রদান করুন", "warning");
        return;
    }
    if (currentPass !== creds.password) {
        showToast("❌ বর্তমান পাসওয়ার্ড সঠিক নয়!", "error");
        document.getElementById("teacherSettingsCurrentPass")?.focus();
        return;
    }

    let finalPassword = creds.password;
    if (newPass) {
        if (newPass.length < 4) {
            showToast("নতুন পাসওয়ার্ড কমপক্ষে ৪ অক্ষরের হতে হবে", "warning");
            return;
        }
        if (newPass !== confirmPass) {
            showToast("নতুন পাসওয়ার্ড ও কনফার্ম পাসওয়ার্ড মিলছে না!", "error");
            return;
        }
        finalPassword = newPass;
    }

    const updated = {
        name: name,
        email: email,
        password: finalPassword
    };

    localStorage.setItem("educheck_teacher_credentials", JSON.stringify(updated));

    if (state.currentUser && state.currentUser.role === 'teacher') {
        state.currentUser.name = `${name} (শিক্ষক)`;
        state.currentUser.email = email;
        const navName = document.getElementById("navUserName");
        if (navName) navName.textContent = state.currentUser.name;
    }

    closeModal("teacherSettingsModal");
    showToast("🎉 শিক্ষক সেটিংস ও পাসওয়ার্ড সফলভাবে আপডেট হয়েছে!", "success");
}

// ==========================================================================
// APP SPLASH SCREEN CONTROLLER
// ==========================================================================
function hideSplashScreen() {
    const splash = document.getElementById("appSplashScreen");
    if (splash) {
        splash.classList.add("fade-out");
        setTimeout(() => {
            splash.style.display = "none";
        }, 400);
    }
}
window.hideSplashScreen = hideSplashScreen;

// ==========================================================================
// USER PROFILE & SETTINGS MODAL (STUDENT & TEACHER)
// ==========================================================================
function openUserProfileModal() {
    const user = state.currentUser;
    if (!user) {
        showToast("প্রোফাইল দেখতে প্রথমে লগইন করুন", "info");
        return;
    }

    const modal = document.getElementById("userProfileModal");
    if (!modal) return;

    // Set Avatar & common info
    const avatarImg = document.getElementById("userProfileModalAvatar");
    const nameEl = document.getElementById("userProfileModalName");
    const badgeRole = document.getElementById("userProfileModalBadgeRole");
    const badgeId = document.getElementById("userProfileModalBadgeId");
    const badgePhone = document.getElementById("userProfileModalBadgePhone");

    if (avatarImg) avatarImg.src = user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.id || 'User'}`;
    if (nameEl) nameEl.textContent = user.name || "ব্যবহারকারী";

    const isTeacher = user.role === "teacher";
    if (badgeRole) {
        badgeRole.innerHTML = isTeacher
            ? `<i class="fa-solid fa-chalkboard-user"></i> শিক্ষক (অ্যাডমিন)`
            : `<i class="fa-solid fa-user-graduate"></i> শিক্ষার্থী (${user.class || 'Class 10'})`;
        badgeRole.className = isTeacher ? "badge badge-teacher" : "badge badge-class";
    }

    if (badgeId) {
        badgeId.innerHTML = `<i class="fa-solid fa-id-card"></i> ID: ${user.id || 'N/A'}`;
    }

    if (badgePhone) {
        badgePhone.innerHTML = `<i class="fa-solid fa-phone"></i> ${user.phone || '--'}`;
        badgePhone.style.display = user.phone ? "inline-flex" : "none";
    }

    const studentSection = document.getElementById("studentProfileEditSection");
    const teacherSection = document.getElementById("teacherProfileEditSection");

    if (isTeacher) {
        if (studentSection) studentSection.style.display = "none";
        if (teacherSection) teacherSection.style.display = "block";
    } else {
        if (teacherSection) teacherSection.style.display = "none";
        if (studentSection) {
            studentSection.style.display = "block";
            const nameIn = document.getElementById("studentEditNameInput");
            const classSel = document.getElementById("studentEditClassSelect");
            const branchSel = document.getElementById("studentEditBranchSelect");
            const phoneIn = document.getElementById("studentEditPhoneInput");

            if (nameIn) nameIn.value = user.name || "";
            if (classSel && user.class) classSel.value = user.class;
            if (branchSel && (user.subject || user.group)) branchSel.value = user.subject || user.group;
            if (phoneIn) phoneIn.value = user.phone || "";
        }
    }

    openModal("userProfileModal");
}
window.openUserProfileModal = openUserProfileModal;

async function handleSaveStudentProfile(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    const user = state.currentUser;
    if (!user || user.role !== 'student') return;

    const nameIn = document.getElementById("studentEditNameInput");
    const classSel = document.getElementById("studentEditClassSelect");
    const branchSel = document.getElementById("studentEditBranchSelect");
    const phoneIn = document.getElementById("studentEditPhoneInput");

    const newName = nameIn ? nameIn.value.trim() : "";
    const newClass = classSel ? classSel.value : user.class;
    const newBranch = branchSel ? branchSel.value : (user.subject || user.group);
    const rawPhone = phoneIn ? phoneIn.value.trim() : "";
    const newPhone = normalizeDigits(rawPhone);

    if (!newName) {
        showToast("দয়া করে আপনার নাম লিখুন", "warning");
        return;
    }

    if (!newPhone || newPhone.length < 6) {
        showToast("সঠিক মোবাইল নম্বর দিন", "warning");
        return;
    }

    user.name = newName;
    user.class = newClass;
    user.subject = newBranch;
    user.group = newBranch;
    user.phone = newPhone;

    // Update in students state
    const idx = state.students.findIndex(s => s.id === user.id);
    if (idx !== -1) {
        state.students[idx] = { ...state.students[idx], ...user };
    } else {
        state.students.push(user);
    }

    // Save to LocalStorage
    localStorage.setItem("educheck_current_user", JSON.stringify(user));
    localStorage.setItem("educheck_saved_student_phone", user.phone);

    // Save to IndexedDB and sync to Firebase Cloud Firestore
    try {
        await window.dbStorage.set("students", user);
    } catch (e) {
        console.warn("Storage sync warning:", e);
    }

    // Refresh UI
    applyAuthStateUI();
    renderStudentDashboard();
    closeModal("userProfileModal");
    showToast("🎉 আপনার প্রোফাইল তথ্য সফলভাবে ক্লাউডে সংরক্ষিত হয়েছে!", "success");
}
window.handleSaveStudentProfile = handleSaveStudentProfile;

async function cycleUserAvatar() {
    const user = state.currentUser;
    if (!user) return;

    const seeds = ["Afiq", "Leo", "Felix", "Jasper", "Oliver", "Nova", "Cosmo", "Milo", "Max", "Sam", "Alex", "Champion", "Pro", "Star"];
    const randomSeed = seeds[Math.floor(Math.random() * seeds.length)] + "_" + Math.floor(Math.random() * 900 + 100);
    const newAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${randomSeed}`;

    user.avatar = newAvatar;
    const modalAvatar = document.getElementById("userProfileModalAvatar");
    if (modalAvatar) modalAvatar.src = newAvatar;

    const navAvatar = document.getElementById("navUserAvatar");
    if (navAvatar) navAvatar.src = newAvatar;

    const bannerAvatar = document.getElementById("studentProfileImg");
    if (bannerAvatar) bannerAvatar.src = newAvatar;

    localStorage.setItem("educheck_current_user", JSON.stringify(user));

    if (user.role === 'student') {
        const idx = state.students.findIndex(s => s.id === user.id);
        if (idx !== -1) state.students[idx].avatar = newAvatar;
        try {
            await window.dbStorage.set("students", user);
        } catch (e) {}
    }

    showToast("✨ নতুন অবতার সেট করা হয়েছে!", "info");
}
window.cycleUserAvatar = cycleUserAvatar;

// ==========================================================================
// 1. THEME SWITCHER CONTROLLER (DARK / LIGHT MODE)
// ==========================================================================
function initTheme() {
    const savedTheme = localStorage.getItem("educheck_theme") || "light";
    const body = document.body;
    const themeBtn = document.getElementById("themeToggleBtn");

    if (savedTheme === "dark") {
        body.classList.add("dark-theme");
        if (themeBtn) themeBtn.innerHTML = `<i class="fa-solid fa-sun"></i>`;
    } else {
        body.classList.remove("dark-theme");
        if (themeBtn) themeBtn.innerHTML = `<i class="fa-solid fa-moon"></i>`;
    }
}

function toggleDarkTheme() {
    const body = document.body;
    const themeBtn = document.getElementById("themeToggleBtn");
    const isDark = body.classList.toggle("dark-theme");

    localStorage.setItem("educheck_theme", isDark ? "dark" : "light");
    if (themeBtn) {
        themeBtn.innerHTML = isDark ? `<i class="fa-solid fa-sun"></i>` : `<i class="fa-solid fa-moon"></i>`;
    }
    showToast(isDark ? "🌙 ডার্ক থিম সক্রিয় করা হয়েছে" : "☀️ লাইট থিম সক্রিয় করা হয়েছে", "info");
}

// ==========================================================================
// 2. LIVE EMERGENCY NOTICE ALERT BAR
// ==========================================================================
function updateLiveNoticeAlert() {
    const alertBar = document.getElementById("liveNoticeAlertBar");
    const alertText = document.getElementById("liveNoticeAlertText");
    if (!alertBar || !alertText) return;

    if (sessionStorage.getItem("educheck_dismissed_notice_alert") === "true") {
        alertBar.style.display = "none";
        return;
    }

    const urgentNotice = (state.notices || []).find(n => n.priority === "urgent");
    if (urgentNotice) {
        alertText.textContent = `${urgentNotice.title} - ${urgentNotice.body.substring(0, 70)}...`;
        alertBar.style.display = "block";
    } else {
        alertBar.style.display = "none";
    }
}

function dismissLiveNoticeAlert() {
    const alertBar = document.getElementById("liveNoticeAlertBar");
    if (alertBar) alertBar.style.display = "none";
    sessionStorage.setItem("educheck_dismissed_notice_alert", "true");
}

function openLiveNoticeModal() {
    const urgentNotice = (state.notices || []).find(n => n.priority === "urgent") || (state.notices || [])[0];
    if (urgentNotice) {
        openNoticeDetailModal(urgentNotice.id);
    }
}

// ==========================================================================
// 3. DAILY ATTENDANCE SYSTEM CONTROLLER
// ==========================================================================
function loadAttendanceForSelectedDate() {
    const dateInput = document.getElementById("attendanceDatePicker");
    if (dateInput && !dateInput.value) {
        dateInput.value = state.selectedAttendanceDate || new Date().toISOString().split('T')[0];
    }
    const selectedDate = dateInput ? dateInput.value : (state.selectedAttendanceDate || new Date().toISOString().split('T')[0]);
    state.selectedAttendanceDate = selectedDate;

    let attRecord = state.attendance.find(a => a.date === selectedDate || a.id === `att_${selectedDate}`);
    if (!attRecord) {
        // Initialize an in-memory attendance record for this date
        const defaultRecords = {};
        state.students.forEach(s => {
            defaultRecords[s.id] = "present";
        });
        attRecord = {
            id: `att_${selectedDate}`,
            date: selectedDate,
            records: defaultRecords,
            updatedAt: new Date().toISOString()
        };
    } else if (!attRecord.records) {
        attRecord.records = {};
    }

    // Ensure all registered students have an entry
    state.students.forEach(s => {
        if (!attRecord.records[s.id]) {
            attRecord.records[s.id] = "present";
        }
    });

    renderAttendanceGrid(attRecord);
}

function renderAttendanceGrid(attRecord) {
    const grid = document.getElementById("teacherAttendanceGrid");
    if (!grid) return;

    if (!attRecord) {
        const selectedDate = state.selectedAttendanceDate || new Date().toISOString().split('T')[0];
        attRecord = state.attendance.find(a => a.date === selectedDate || a.id === `att_${selectedDate}`) || {
            id: `att_${selectedDate}`,
            date: selectedDate,
            records: {}
        };
    }

    const students = state.students || [];
    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;

    students.forEach(s => {
        const st = attRecord.records ? (attRecord.records[s.id] || "present") : "present";
        if (st === "present") presentCount++;
        else if (st === "absent") absentCount++;
        else if (st === "late") lateCount++;
    });

    const elTotal = document.getElementById("attStatTotal");
    const elPres = document.getElementById("attStatPresent");
    const elAbs = document.getElementById("attStatAbsent");
    const elLate = document.getElementById("attStatLate");

    if (elTotal) elTotal.textContent = students.length;
    if (elPres) elPres.textContent = presentCount;
    if (elAbs) elAbs.textContent = absentCount;
    if (elLate) elLate.textContent = lateCount;

    if (students.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 2.5rem; background: var(--bg-surface); border-radius: 12px; border: 1px dashed var(--border);">
                <i class="fa-solid fa-user-xmark" style="font-size: 2.5rem; color: #94a3b8; margin-bottom: 10px;"></i>
                <h4>কোনো নিবন্ধিত শিক্ষার্থী পাওয়া যায়নি</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted);">প্রথমে শিক্ষার্থী প্যানেল থেকে শিক্ষার্থী যোগ করুন।</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = students.map(s => {
        const status = attRecord.records ? (attRecord.records[s.id] || "present") : "present";
        return `
            <div class="attendance-card ${status}">
                <div class="att-card-header">
                    <img src="${s.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + s.name}" class="student-avatar-sm" alt="Student">
                    <div class="att-student-meta">
                        <h4>${s.name}</h4>
                        <span>${s.class || 'Class 10'} • ID: ${s.id}</span>
                    </div>
                </div>
                <div class="att-status-toggles">
                    <button class="att-btn att-present ${status === 'present' ? 'active' : ''}" onclick="setStudentAttendanceStatus('${s.id}', 'present')">
                        <i class="fa-solid fa-check"></i> উপস্থিত
                    </button>
                    <button class="att-btn att-absent ${status === 'absent' ? 'active' : ''}" onclick="setStudentAttendanceStatus('${s.id}', 'absent')">
                        <i class="fa-solid fa-xmark"></i> অনুপস্থিত
                    </button>
                    <button class="att-btn att-late ${status === 'late' ? 'active' : ''}" onclick="setStudentAttendanceStatus('${s.id}', 'late')">
                        <i class="fa-solid fa-clock"></i> বিলম্ব
                    </button>
                </div>
                ${status === 'absent' ? `
                    <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #fca5a5; display: flex; justify-content: space-between; align-items: center;">
                        <small style="color: #ef4444; font-weight: 600;"><i class="fa-solid fa-circle-exclamation"></i> অনুপস্থিত সতর্কবার্তা</small>
                        <button class="btn btn-outline" style="font-size: 0.75rem; padding: 4px 8px; color: #059669; border-color: #059669;" onclick="sendAbsentWhatsAppAlert('${s.id}')" title="অভিভাবককে হোয়াটসঅ্যাপে অনুপস্থিতির নোটিশ পাঠান">
                            <i class="fa-brands fa-whatsapp"></i> সতর্কবার্তা পাঠান
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function setStudentAttendanceStatus(studentId, status) {
    const selectedDate = state.selectedAttendanceDate || new Date().toISOString().split('T')[0];
    let attRecord = state.attendance.find(a => a.date === selectedDate || a.id === `att_${selectedDate}`);
    if (!attRecord) {
        attRecord = {
            id: `att_${selectedDate}`,
            date: selectedDate,
            records: {},
            updatedAt: new Date().toISOString()
        };
        state.attendance.push(attRecord);
    }
    if (!attRecord.records) attRecord.records = {};
    attRecord.records[studentId] = status;
    attRecord.updatedAt = new Date().toISOString();

    renderAttendanceGrid(attRecord);
}

function markAllStudentsPresent() {
    const selectedDate = state.selectedAttendanceDate || new Date().toISOString().split('T')[0];
    let attRecord = state.attendance.find(a => a.date === selectedDate || a.id === `att_${selectedDate}`);
    if (!attRecord) {
        attRecord = {
            id: `att_${selectedDate}`,
            date: selectedDate,
            records: {},
            updatedAt: new Date().toISOString()
        };
        state.attendance.push(attRecord);
    }
    if (!attRecord.records) attRecord.records = {};
    state.students.forEach(s => {
        attRecord.records[s.id] = "present";
    });
    attRecord.updatedAt = new Date().toISOString();

    renderAttendanceGrid(attRecord);
    showToast("সকল শিক্ষার্থীকে উপস্থিত হিসেবে মার্ক করা হয়েছে", "success");
}

async function saveDailyAttendance() {
    const selectedDate = state.selectedAttendanceDate || new Date().toISOString().split('T')[0];
    let attRecord = state.attendance.find(a => a.date === selectedDate || a.id === `att_${selectedDate}`);
    if (!attRecord) {
        attRecord = {
            id: `att_${selectedDate}`,
            date: selectedDate,
            records: {},
            updatedAt: new Date().toISOString()
        };
        state.students.forEach(s => {
            attRecord.records[s.id] = "present";
        });
        state.attendance.push(attRecord);
    }

    try {
        await window.dbStorage.set("attendance", attRecord);
        showToast(`✅ ${selectedDate} তারিখের উপস্থিতি সফলভাবে সংরক্ষিত ও ক্লাউডে সিঙ্ক হয়েছে!`, "success");
    } catch (err) {
        showToast("উপস্থিতি সংরক্ষণ করতে সমস্যা হয়েছে: " + err.message, "error");
    }
}

function sendAbsentWhatsAppAlert(studentId) {
    const student = state.students.find(s => s.id === studentId);
    if (!student) return;

    const creds = getAuthorizedTeacherCredentials();
    const teacherName = creds.name || "আফিক স্যার";
    const dateStr = state.selectedAttendanceDate || new Date().toISOString().split('T')[0];

    const message = 
        `📢 *অনুপস্থিতি নোটিফিকেশন - একাডেমিয়া*\n\n` +
        `সম্মানিত অভিভাবক,\n` +
        `আপনার সন্তান *${student.name}* (শ্রেণি: ${student.class || 'Class 10'}, আইডি: ${student.id}) আজ *${dateStr}* ক্লাসে অনুপস্থিত রয়েছে।\n\n` +
        `অনুপস্থিতির কারণ সম্পর্কে অবগত করতে অথবা বিশেষ প্রয়োজনে যোগাযোগ করার জন্য অনুরোধ করা হলো।\n\n` +
        `👨‍🏫 *শিক্ষক:* ${teacherName}\n` +
        `📞 যোগাযোগ: ${creds.emails[0] || 'শিক্ষক প্যানেল'}`;

    const phoneDigits = (student.phone || "").replace(/\D/g, "");
    let cleanPhone = phoneDigits;
    if (cleanPhone.startsWith("0")) {
        cleanPhone = "880" + cleanPhone.substring(1);
    } else if (!cleanPhone.startsWith("880") && cleanPhone.length === 10) {
        cleanPhone = "880" + cleanPhone;
    }

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
}

// ==========================================================================
// 4. STUDENT DOUBTS CORNER & TEACHER RESOLUTION
// ==========================================================================
function openNewDoubtModal() {
    const form = document.getElementById("newDoubtForm");
    if (form) form.reset();
    const previewWrap = document.getElementById("newDoubtPreviewContainer");
    if (previewWrap) previewWrap.style.display = "none";

    const fileInput = document.getElementById("newDoubtFile");
    if (fileInput) {
        fileInput.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (re) => {
                    const img = document.getElementById("newDoubtPreviewImg");
                    if (img) img.src = re.target.result;
                    if (previewWrap) previewWrap.style.display = "block";
                };
                reader.readAsDataURL(file);
            }
        };
    }

    openModal("newDoubtModal");
}

async function handleCreateDoubt(event) {
    if (event) event.preventDefault();
    const student = state.currentUser;
    if (!student || student.role !== 'student') {
        showToast("কেবলমাত্র শিক্ষার্থীরা প্রশ্ন বা ডাউট পাঠাতে পারে", "warning");
        return;
    }

    const subject = document.getElementById("newDoubtSubject")?.value || "গণিত";
    const title = (document.getElementById("newDoubtTitle")?.value || "").trim();
    const desc = (document.getElementById("newDoubtDesc")?.value || "").trim();
    const fileInput = document.getElementById("newDoubtFile");

    if (!title || !desc) {
        showToast("প্রশ্ন বা সমস্যার শিরোনাম ও বিবরণ লিখুন", "warning");
        return;
    }

    let imageBase64 = null;
    if (fileInput && fileInput.files && fileInput.files[0]) {
        try {
            imageBase64 = await readFileAsDataURL(fileInput.files[0]);
        } catch (e) {
            console.warn("Doubt image conversion notice:", e);
        }
    }

    const doubt = {
        id: "doubt_" + Date.now(),
        studentId: student.id,
        studentName: student.name,
        studentClass: student.class || "Class 10",
        studentPhone: student.phone || "",
        subject: subject,
        title: title,
        desc: desc,
        image: imageBase64,
        status: "pending",
        solution: null,
        createdAt: new Date().toISOString()
    };

    try {
        await window.dbStorage.set("doubts", doubt);
        state.doubts.unshift(doubt);
        closeModal("newDoubtModal");
        renderStudentDoubts();
        showToast("🎉 আপনার প্রশ্নটি শিক্ষকের কাছে সফলভাবে পাঠানো হয়েছে!", "success");
    } catch (err) {
        showToast("প্রশ্ন পাঠাতে সমস্যা হয়েছে: " + err.message, "error");
    }
}

function renderStudentDoubts() {
    const grid = document.getElementById("studentDoubtsGrid");
    if (!grid) return;

    const student = state.currentUser;
    if (!student) return;

    const myDoubts = (state.doubts || []).filter(d => d.studentId === student.id);
    const pendingCount = myDoubts.filter(d => d.status === 'pending').length;
    const badge = document.getElementById("studentPendingDoubtsCount");
    if (badge) badge.textContent = pendingCount;

    if (myDoubts.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 2.5rem; background: var(--bg-surface); border-radius: 12px; border: 1px dashed var(--border);">
                <i class="fa-solid fa-circle-question" style="font-size: 2.5rem; color: #94a3b8; margin-bottom: 10px;"></i>
                <h4>আপনার কোনো প্রশ্ন বা ডাউট নেই</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.25rem;">পড়াশোনার যেকোনো বিষয়ে না বুঝলে শিক্ষকের কাছে সরাসরি প্রশ্ন পাঠান।</p>
                <button class="btn btn-primary" onclick="openNewDoubtModal()">
                    <i class="fa-solid fa-plus"></i> প্রথম প্রশ্ন করুন
                </button>
            </div>
        `;
        return;
    }

    grid.innerHTML = myDoubts.map(d => {
        const isResolved = d.status === 'resolved';
        return `
            <div class="doubt-card ${isResolved ? 'resolved' : 'pending'}">
                <div class="doubt-card-header">
                    <span class="doubt-subject-badge">${d.subject || 'সাধারণ'}</span>
                    <span class="doubt-status-pill ${isResolved ? 'resolved' : 'pending'}">
                        ${isResolved ? '<i class="fa-solid fa-circle-check"></i> সমাধান সম্পন্ন' : '<i class="fa-solid fa-clock"></i> উত্তরের অপেক্ষায়'}
                    </span>
                </div>
                <h4 class="doubt-title">${d.title}</h4>
                <p class="doubt-desc">${d.desc}</p>
                ${d.image ? `
                    <div class="doubt-img-wrap" onclick="window.open('${d.image}', '_blank')">
                        <img src="${d.image}" alt="Doubt Photo">
                    </div>
                ` : ''}
                <div class="doubt-date"><i class="fa-regular fa-calendar"></i> ${formatBanglaDateTime(d.createdAt)}</div>
                
                ${isResolved && d.solution ? `
                    <div class="doubt-solution-box">
                        <div class="sol-header">
                            <strong><i class="fa-solid fa-chalkboard-user"></i> ${d.solution.teacherName || 'আফিক স্যার'} এর সমাধান:</strong>
                            <small>${formatBanglaDateTime(d.solution.resolvedAt)}</small>
                        </div>
                        <div class="sol-text">${d.solution.text}</div>
                        ${d.solution.audioUrl ? `
                            <div class="sol-audio-wrap">
                                <label><i class="fa-solid fa-microphone"></i> অডিও গাইডলাইন শুনুন:</label>
                                <audio controls src="${d.solution.audioUrl}" style="width: 100%; height: 36px; margin-top: 4px;"></audio>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function renderTeacherDoubts() {
    const grid = document.getElementById("teacherDoubtsGrid");
    if (!grid) return;

    const searchTerm = (document.getElementById("teacherDoubtSearch")?.value || "").toLowerCase();
    const statusFilter = document.getElementById("teacherDoubtStatusFilter")?.value || "all";

    let doubts = state.doubts || [];

    if (statusFilter !== "all") {
        doubts = doubts.filter(d => d.status === statusFilter);
    }
    if (searchTerm) {
        doubts = doubts.filter(d => 
            (d.title && d.title.toLowerCase().includes(searchTerm)) ||
            (d.desc && d.desc.toLowerCase().includes(searchTerm)) ||
            (d.studentName && d.studentName.toLowerCase().includes(searchTerm)) ||
            (d.subject && d.subject.toLowerCase().includes(searchTerm))
        );
    }

    const pendingDoubts = state.doubts.filter(d => d.status === 'pending').length;
    const badge = document.getElementById("teacherPendingDoubtsCount");
    if (badge) badge.textContent = pendingDoubts;

    if (doubts.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 2.5rem; background: var(--bg-surface); border-radius: 12px; border: 1px dashed var(--border);">
                <i class="fa-solid fa-circle-check" style="font-size: 2.5rem; color: #10b981; margin-bottom: 10px;"></i>
                <h4>কোনো অপেক্ষমান ডাউট বা প্রশ্ন নেই</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted);">শিক্ষার্থীরা কোনো নতুন প্রশ্ন পাঠালে তা এখানে সরাসরি চলে আসবে।</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = doubts.map(d => {
        const isResolved = d.status === 'resolved';
        return `
            <div class="doubt-card ${isResolved ? 'resolved' : 'pending'}">
                <div class="doubt-card-header">
                    <span class="doubt-subject-badge">${d.subject || 'সাধারণ'}</span>
                    <span class="doubt-status-pill ${isResolved ? 'resolved' : 'pending'}">
                        ${isResolved ? '<i class="fa-solid fa-circle-check"></i> সমাধান হয়েছে' : '<i class="fa-solid fa-clock"></i> পেন্ডিং'}
                    </span>
                </div>
                <div style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 6px;">
                    <i class="fa-solid fa-user-graduate"></i> <b>${d.studentName}</b> (${d.studentClass || 'Class 10'}) • <i class="fa-solid fa-phone"></i> ${d.studentPhone}
                </div>
                <h4 class="doubt-title">${d.title}</h4>
                <p class="doubt-desc">${d.desc}</p>
                ${d.image ? `
                    <div class="doubt-img-wrap" onclick="window.open('${d.image}', '_blank')">
                        <img src="${d.image}" alt="Doubt Photo">
                    </div>
                ` : ''}
                
                ${isResolved && d.solution ? `
                    <div class="doubt-solution-box" style="margin-top: 10px;">
                        <div class="sol-header">
                            <strong><i class="fa-solid fa-check-double"></i> দেওয়া সমাধান:</strong>
                        </div>
                        <div class="sol-text">${d.solution.text}</div>
                    </div>
                ` : ''}

                <div style="margin-top: 12px; display: flex; justify-content: flex-end; gap: 8px;">
                    <button class="btn ${isResolved ? 'btn-outline' : 'btn-primary'}" style="font-size: 0.82rem; padding: 6px 12px;" onclick="openResolveDoubtModal('${d.id}')">
                        <i class="fa-solid ${isResolved ? 'fa-pen-to-square' : 'fa-reply'}"></i> ${isResolved ? 'সমাধান এডিট করুন' : 'সমাধান দিন'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function openResolveDoubtModal(doubtId) {
    const doubt = (state.doubts || []).find(d => d.id === doubtId);
    if (!doubt) return;

    state.currentDoubtToResolve = doubt;
    state.currentDoubtAudioBlob = doubt.solution ? doubt.solution.audioUrl : null;

    const meta = document.getElementById("resolveDoubtStudentMeta");
    const title = document.getElementById("resolveDoubtTitle");
    const desc = document.getElementById("resolveDoubtDesc");
    const attachWrap = document.getElementById("resolveDoubtAttachmentWrap");
    const attachImg = document.getElementById("resolveDoubtAttachment");
    const solutionText = document.getElementById("resolveDoubtSolutionText");
    const audioPlayer = document.getElementById("doubtVoicePlayer");
    const statusText = document.getElementById("doubtVoiceStatusText");

    if (meta) meta.textContent = `${doubt.studentName} (${doubt.studentClass || 'Class 10'}) • বিষয়: ${doubt.subject}`;
    if (title) title.textContent = doubt.title;
    if (desc) desc.textContent = doubt.desc;

    if (doubt.image) {
        if (attachImg) attachImg.src = doubt.image;
        if (attachWrap) attachWrap.style.display = "block";
    } else {
        if (attachWrap) attachWrap.style.display = "none";
    }

    if (solutionText) solutionText.value = doubt.solution ? doubt.solution.text : "";
    if (audioPlayer) {
        if (doubt.solution && doubt.solution.audioUrl) {
            audioPlayer.src = doubt.solution.audioUrl;
            audioPlayer.style.display = "block";
            if (statusText) statusText.textContent = "সংরক্ষিত অডিও লোড হয়েছে";
        } else {
            audioPlayer.src = "";
            audioPlayer.style.display = "none";
            if (statusText) statusText.textContent = "কোনো অডিও নেই";
        }
    }

    openModal("resolveDoubtModal");
}

async function toggleDoubtVoiceRecording() {
    const btn = document.getElementById("btnRecordDoubtVoice");
    const textSpan = document.getElementById("recordDoubtVoiceText");
    const statusSpan = document.getElementById("doubtVoiceStatusText");
    const audioPlayer = document.getElementById("doubtVoicePlayer");

    if (state.doubtMediaRecorder && state.doubtMediaRecorder.state === "recording") {
        state.doubtMediaRecorder.stop();
        if (textSpan) textSpan.textContent = "পুনরায় রেকর্ড করুন";
        if (btn) btn.classList.remove("recording-active");
        if (statusSpan) statusSpan.textContent = "✅ রেকর্ডিং সম্পন্ন!";
        return;
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        state.doubtMediaRecorder = new MediaRecorder(stream);
        state.doubtAudioChunks = [];

        state.doubtMediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) state.doubtAudioChunks.push(e.data);
        };

        state.doubtMediaRecorder.onstop = () => {
            const blob = new Blob(state.doubtAudioChunks, { type: "audio/webm" });
            const reader = new FileReader();
            reader.onloadend = () => {
                state.currentDoubtAudioBlob = reader.result;
                if (audioPlayer) {
                    audioPlayer.src = reader.result;
                    audioPlayer.style.display = "block";
                }
            };
            reader.readAsDataURL(blob);
            stream.getTracks().forEach(t => t.stop());
        };

        state.doubtMediaRecorder.start();
        if (textSpan) textSpan.textContent = "রেকর্ডিং থামান";
        if (btn) btn.classList.add("recording-active");
        if (statusSpan) statusSpan.textContent = "🔴 রেকর্ডিং হচ্ছে...";
    } catch (err) {
        showToast("মাইক্রোফোন চালু করা যায়নি: " + err.message, "error");
    }
}

async function handleSaveDoubtSolution() {
    const doubt = state.currentDoubtToResolve;
    if (!doubt) return;

    const solText = (document.getElementById("resolveDoubtSolutionText")?.value || "").trim();
    if (!solText && !state.currentDoubtAudioBlob) {
        showToast("অনুগ্রহ করে সমাধানের ব্যাখ্যা বা ভয়েস নোট প্রদান করুন", "warning");
        return;
    }

    const creds = getAuthorizedTeacherCredentials();
    const teacherName = creds.name || "আফিক স্যার";

    doubt.status = "resolved";
    doubt.solution = {
        text: solText || "ভয়েস নোট ও সমাধান নিচে সংযুক্ত করা হয়েছে।",
        audioUrl: state.currentDoubtAudioBlob || null,
        resolvedAt: new Date().toISOString(),
        teacherName: teacherName
    };

    try {
        await window.dbStorage.set("doubts", doubt);
        closeModal("resolveDoubtModal");
        renderTeacherDoubts();
        showToast("🎉 সমাধান সফলভাবে শিক্ষার্থীর পোর্টালে পাঠানো হয়েছে!", "success");
    } catch (err) {
        showToast("সমাধান সংরক্ষণ করতে সমস্যা হয়েছে: " + err.message, "error");
    }
}

// ==========================================================================
// 5. STUDY MATERIALS & LECTURE NOTES BANK CONTROLLER
// ==========================================================================
function openAddStudyMaterialModal() {
    const form = document.getElementById("addStudyMaterialForm");
    if (form) form.reset();
    toggleMaterialInputType("file");
    openModal("addStudyMaterialModal");
}

function toggleMaterialInputType(type) {
    const fileGroup = document.getElementById("materialFileInputGroup");
    const linkGroup = document.getElementById("materialLinkInputGroup");
    if (type === "link") {
        if (fileGroup) fileGroup.style.display = "none";
        if (linkGroup) linkGroup.style.display = "block";
    } else {
        if (fileGroup) fileGroup.style.display = "block";
        if (linkGroup) linkGroup.style.display = "none";
    }
}

async function handleCreateStudyMaterial(event) {
    if (event) event.preventDefault();

    const title = (document.getElementById("newMaterialTitle")?.value || "").trim();
    const classLevel = document.getElementById("newMaterialClass")?.value || "Class 10";
    const subject = (document.getElementById("newMaterialSubject")?.value || "").trim();
    const desc = (document.getElementById("newMaterialDesc")?.value || "").trim();
    const typeRadios = document.getElementsByName("materialFileType");
    let type = "file";
    typeRadios.forEach(r => { if (r.checked) type = r.value; });

    if (!title || !subject) {
        showToast("শিটের শিরোনাম ও বিষয় লিখুন", "warning");
        return;
    }

    let fileData = null;
    let fileName = null;
    let linkUrl = null;

    if (type === "file") {
        const fileInput = document.getElementById("newMaterialFile");
        if (!fileInput || !fileInput.files || !fileInput.files[0]) {
            showToast("অনুগ্রহ করে ফাইল সংযুক্ত করুন (বা লিংক রেডিও নির্বাচন করুন)", "warning");
            return;
        }
        const file = fileInput.files[0];
        fileName = file.name;
        try {
            fileData = await readFileAsDataURL(file);
        } catch (e) {
            showToast("ফাইল লোড করতে ব্যর্থ হয়েছে", "error");
            return;
        }
    } else {
        linkUrl = (document.getElementById("newMaterialLink")?.value || "").trim();
        if (!linkUrl) {
            showToast("গুগল ড্রাইভ বা ওয়েব লিংক লিখুন", "warning");
            return;
        }
    }

    const material = {
        id: "mat_" + Date.now(),
        title: title,
        classLevel: classLevel,
        subject: subject,
        desc: desc,
        type: type,
        fileData: fileData,
        fileName: fileName,
        linkUrl: linkUrl,
        createdAt: new Date().toISOString(),
        author: "আফিক স্যার"
    };

    try {
        await window.dbStorage.set("study_materials", material);
        state.studyMaterials.unshift(material);
        closeModal("addStudyMaterialModal");
        renderTeacherStudyMaterials();
        showToast("🎉 স্টাডি শিট সফলভাবে যোগ হয়েছে!", "success");
    } catch (err) {
        showToast("শিট সংরক্ষণ করতে সমস্যা হয়েছে: " + err.message, "error");
    }
}

async function deleteStudyMaterial(matId) {
    if (!confirm("আপনি কি নিশ্চিতভাবে এই স্টাডি শিটটি মুছে ফেলতে চান?")) return;
    try {
        await window.dbStorage.delete("study_materials", matId);
        state.studyMaterials = state.studyMaterials.filter(m => m.id !== matId);
        renderTeacherStudyMaterials();
        showToast("স্টাডি শিট মুছে ফেলা হয়েছে", "info");
    } catch (e) {
        showToast("মুছতে সমস্যা হয়েছে: " + e.message, "error");
    }
}

function renderTeacherStudyMaterials() {
    const grid = document.getElementById("teacherMaterialsGrid");
    if (!grid) return;

    const materials = state.studyMaterials || [];
    if (materials.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 2.5rem; background: var(--bg-surface); border-radius: 12px; border: 1px dashed var(--border);">
                <i class="fa-solid fa-book-bookmark" style="font-size: 2.5rem; color: #94a3b8; margin-bottom: 10px;"></i>
                <h4>কোনো স্টাডি শিট আপলোড করা হয়নি</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.25rem;">শিক্ষার্থীদের জন্য হ্যান্ডনোট, শিট ও গাইড আপলোড করুন।</p>
                <button class="btn btn-primary" onclick="openAddStudyMaterialModal()">
                    <i class="fa-solid fa-plus"></i> প্রথম শিট যোগ করুন
                </button>
            </div>
        `;
        return;
    }

    grid.innerHTML = materials.map(m => `
        <div class="material-card">
            <div class="material-type-icon ${m.type === 'file' ? 'pdf' : 'link'}">
                <i class="fa-solid ${m.type === 'file' ? 'fa-file-pdf' : 'fa-link'}"></i>
            </div>
            <div class="material-content">
                <div class="material-meta">
                    <span class="badge badge-class">${m.classLevel || 'সকল শ্রেণি'}</span>
                    <span class="badge badge-subject">${m.subject}</span>
                </div>
                <h4 class="material-title">${m.title}</h4>
                <p class="material-desc">${m.desc || 'কোনো বিবরণ নেই'}</p>
                <div class="material-footer">
                    <small class="text-muted"><i class="fa-regular fa-calendar"></i> ${formatBanglaDateTime(m.createdAt)}</small>
                    <div style="display: flex; gap: 6px;">
                        <button class="btn btn-outline" style="font-size: 0.78rem; padding: 4px 8px;" onclick="${m.type === 'file' ? `window.open('${m.fileData}', '_blank')` : `window.open('${m.linkUrl}', '_blank')`}">
                            <i class="fa-solid fa-arrow-up-right-from-square"></i> খুলুন
                        </button>
                        <button class="btn btn-outline" style="font-size: 0.78rem; padding: 4px 8px; color: #ef4444; border-color: #fca5a5;" onclick="deleteStudyMaterial('${m.id}')" title="মুছে ফেলুন">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

function renderStudentStudyMaterials() {
    const grid = document.getElementById("studentMaterialsGrid");
    if (!grid) return;

    const student = state.currentUser;
    const studentClass = student ? (student.class || "Class 10") : "Class 10";
    const materials = (state.studyMaterials || []).filter(m => m.classLevel === "All" || m.classLevel === studentClass || !m.classLevel);

    if (materials.length === 0) {
        grid.innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 2.5rem; background: var(--bg-surface); border-radius: 12px; border: 1px dashed var(--border);">
                <i class="fa-solid fa-book-bookmark" style="font-size: 2.5rem; color: #94a3b8; margin-bottom: 10px;"></i>
                <h4>আপনার শ্রেণির জন্য এখনো কোনো লেকচার শিট নেই</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted);">শিক্ষক নোট আপলোড করলে আপনি এখান থেকে সরাসরি দেখতে ও ডাউনলোড করতে পারবেন।</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = materials.map(m => `
        <div class="material-card">
            <div class="material-type-icon ${m.type === 'file' ? 'pdf' : 'link'}">
                <i class="fa-solid ${m.type === 'file' ? 'fa-file-pdf' : 'fa-link'}"></i>
            </div>
            <div class="material-content">
                <div class="material-meta">
                    <span class="badge badge-class">${m.classLevel || 'সকল শ্রেণি'}</span>
                    <span class="badge badge-subject">${m.subject}</span>
                </div>
                <h4 class="material-title">${m.title}</h4>
                <p class="material-desc">${m.desc || 'কোনো বিবরণ নেই'}</p>
                <div class="material-footer">
                    <small class="text-muted"><i class="fa-regular fa-calendar"></i> ${formatBanglaDateTime(m.createdAt)}</small>
                    <button class="btn btn-primary" style="font-size: 0.82rem; padding: 6px 12px;" onclick="${m.type === 'file' ? `window.open('${m.fileData}', '_blank')` : `window.open('${m.linkUrl}', '_blank')`}">
                        <i class="fa-solid fa-cloud-arrow-down"></i> শিট দেখুন / ডাউনলোড
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

// ==========================================================================
// 6. DIGITAL NOTICE BOARD & BROADCAST CONTROLLER
// ==========================================================================
function openCreateNoticeModal() {
    const form = document.getElementById("createNoticeForm");
    if (form) form.reset();
    openModal("createNoticeModal");
}

async function handleCreateNotice(event) {
    if (event) event.preventDefault();

    const title = (document.getElementById("newNoticeTitle")?.value || "").trim();
    const category = document.getElementById("newNoticeCategory")?.value || "general";
    const priority = document.getElementById("newNoticePriority")?.value || "normal";
    const body = (document.getElementById("newNoticeBody")?.value || "").trim();

    if (!title || !body) {
        showToast("নোটিশের শিরোনাম ও বিস্তারিত বিষয় লিখুন", "warning");
        return;
    }

    const creds = getAuthorizedTeacherCredentials();
    const teacherName = creds.name || "আফিক স্যার";

    const notice = {
        id: "notice_" + Date.now(),
        title: title,
        category: category,
        priority: priority,
        body: body,
        createdAt: new Date().toISOString(),
        author: teacherName
    };

    try {
        await window.dbStorage.set("notices", notice);
        state.notices.unshift(notice);
        closeModal("createNoticeModal");
        renderTeacherNotices();
        updateLiveNoticeAlert();
        showToast("🎉 নোটিশ সফলভাবে প্রকাশিত হয়েছে!", "success");
    } catch (err) {
        showToast("নোটিশ প্রকাশ করতে সমস্যা হয়েছে: " + err.message, "error");
    }
}

async function deleteNotice(noticeId) {
    if (!confirm("আপনি কি নিশ্চিতভাবে এই নোটিশটি মুছে ফেলতে চান?")) return;
    try {
        await window.dbStorage.delete("notices", noticeId);
        state.notices = state.notices.filter(n => n.id !== noticeId);
        renderTeacherNotices();
        updateLiveNoticeAlert();
        showToast("নোটিশ মুছে ফেলা হয়েছে", "info");
    } catch (e) {
        showToast("মুছতে সমস্যা হয়েছে: " + e.message, "error");
    }
}

function renderTeacherNotices() {
    const list = document.getElementById("teacherNoticesList");
    if (!list) return;

    const notices = state.notices || [];
    if (notices.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: 2.5rem; background: var(--bg-surface); border-radius: 12px; border: 1px dashed var(--border);">
                <i class="fa-solid fa-bullhorn" style="font-size: 2.5rem; color: #94a3b8; margin-bottom: 10px;"></i>
                <h4>কোনো প্রকাশিত নোটিশ নেই</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.25rem;">শিক্ষার্থী ও অভিভাবকদের প্রয়োজনীয় তথ্য জানাতে নোটিশ প্রকাশ করুন।</p>
                <button class="btn btn-primary" onclick="openCreateNoticeModal()">
                    <i class="fa-solid fa-plus"></i> প্রথম নোটিশ প্রকাশ করুন
                </button>
            </div>
        `;
        return;
    }

    list.innerHTML = notices.map(n => {
        const isUrgent = n.priority === 'urgent';
        return `
            <div class="notice-card ${isUrgent ? 'urgent' : ''}">
                <div class="notice-header">
                    <div>
                        <span class="badge ${isUrgent ? 'badge-urgent' : 'badge-general'}">
                            <i class="fa-solid ${isUrgent ? 'fa-triangle-exclamation' : 'fa-bullhorn'}"></i> ${isUrgent ? 'জরুরি নোটিশ' : (n.category || 'সাধারণ')}
                        </span>
                    </div>
                    <small class="text-muted"><i class="fa-regular fa-clock"></i> ${formatBanglaDateTime(n.createdAt)}</small>
                </div>
                <h4 class="notice-title">${n.title}</h4>
                <p class="notice-body-snippet">${n.body}</p>
                <div class="notice-footer">
                    <button class="btn btn-outline" style="font-size: 0.8rem; padding: 4px 10px;" onclick="openNoticeDetailModal('${n.id}')">
                        <i class="fa-solid fa-eye"></i> বিস্তারিত
                    </button>
                    <div style="display: flex; gap: 6px;">
                        <button class="btn btn-success" style="font-size: 0.8rem; padding: 4px 10px;" onclick="sendNoticeWhatsAppBroadcast('${n.id}')">
                            <i class="fa-brands fa-whatsapp"></i> ব্রডকাস্ট
                        </button>
                        <button class="btn btn-outline" style="font-size: 0.8rem; padding: 4px 8px; color: #ef4444; border-color: #fca5a5;" onclick="deleteNotice('${n.id}')" title="মুছে ফেলুন">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderStudentNotices() {
    const list = document.getElementById("studentNoticesList");
    if (!list) return;

    const notices = state.notices || [];
    if (notices.length === 0) {
        list.innerHTML = `
            <div style="text-align: center; padding: 2.5rem; background: var(--bg-surface); border-radius: 12px; border: 1px dashed var(--border);">
                <i class="fa-solid fa-bullhorn" style="font-size: 2.5rem; color: #94a3b8; margin-bottom: 10px;"></i>
                <h4>এখনো কোনো নতুন নোটিশ নেই</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted);">একাডেমির সকল আপডেট ও জরুরি বার্তা এখানে দেখতে পাবেন।</p>
            </div>
        `;
        return;
    }

    list.innerHTML = notices.map(n => {
        const isUrgent = n.priority === 'urgent';
        return `
            <div class="notice-card ${isUrgent ? 'urgent' : ''}">
                <div class="notice-header">
                    <div>
                        <span class="badge ${isUrgent ? 'badge-urgent' : 'badge-general'}">
                            <i class="fa-solid ${isUrgent ? 'fa-triangle-exclamation' : 'fa-bullhorn'}"></i> ${isUrgent ? 'জরুরি নোটিশ' : (n.category || 'সাধারণ')}
                        </span>
                    </div>
                    <small class="text-muted"><i class="fa-regular fa-clock"></i> ${formatBanglaDateTime(n.createdAt)}</small>
                </div>
                <h4 class="notice-title">${n.title}</h4>
                <p class="notice-body-snippet">${n.body}</p>
                <div class="notice-footer">
                    <button class="btn btn-outline" style="font-size: 0.82rem; padding: 6px 12px;" onclick="openNoticeDetailModal('${n.id}')">
                        <i class="fa-solid fa-file-lines"></i> সম্পূর্ণ নোটিশ পড়ুন
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function openNoticeDetailModal(noticeId) {
    const notice = (state.notices || []).find(n => n.id === noticeId);
    if (!notice) return;

    state.currentViewingNotice = notice;

    const titleEl = document.getElementById("viewNoticeTitle");
    const dateEl = document.getElementById("viewNoticeDate");
    const badgeWrap = document.getElementById("viewNoticeBadgeWrap");
    const bodyEl = document.getElementById("viewNoticeBody");

    if (titleEl) titleEl.textContent = notice.title;
    if (dateEl) dateEl.textContent = `প্রকাশিত: ${formatBanglaDateTime(notice.createdAt)} • নির্দেশক: ${notice.author || 'আফিক স্যার'}`;
    if (badgeWrap) {
        badgeWrap.innerHTML = `
            <span class="badge ${notice.priority === 'urgent' ? 'badge-urgent' : 'badge-general'}">
                <i class="fa-solid ${notice.priority === 'urgent' ? 'fa-triangle-exclamation' : 'fa-bullhorn'}"></i> ${notice.priority === 'urgent' ? 'জরুরি নোটিশ' : (notice.category || 'সাধারণ')}
            </span>
        `;
    }
    if (bodyEl) bodyEl.textContent = notice.body;

    openModal("viewNoticeModal");
}

function sendNoticeWhatsAppBroadcast(noticeId) {
    const notice = noticeId ? (state.notices || []).find(n => n.id === noticeId) : state.currentViewingNotice;
    if (!notice) return;

    const creds = getAuthorizedTeacherCredentials();
    const teacherName = creds.name || "আফিক স্যার";

    const message = 
        `📢 *একাডেমিয়া - জরুরি নোটিশ*\n\n` +
        `📌 *বিষয়:* ${notice.title}\n` +
        `📅 *তারিখ:* ${formatBanglaDateTime(notice.createdAt)}\n\n` +
        `${notice.body}\n\n` +
        `👨‍🏫 *নির্দেশনায়:* ${teacherName}`;

    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
}

// ==========================================================================
// 7. STUDENT PERFORMANCE ANALYTICS SVG CHART
// ==========================================================================
function renderStudentPerformanceChart(student, checkedSubs) {
    const container = document.getElementById("studentPerformanceChartSvgContainer");
    if (!container) return;

    if (!student) student = state.currentUser;
    if (!checkedSubs) {
        checkedSubs = (state.submissions || []).filter(s => s.studentId === student?.id && s.status === 'checked');
    }

    // Sort chronologically (oldest to newest)
    const sortedSubs = [...checkedSubs].sort((a, b) => new Date(a.submittedAt || 0) - new Date(b.submittedAt || 0));

    const totalEvaluated = sortedSubs.length;
    let avgScorePct = 0;
    let highestScorePct = 0;
    let trendDiff = 0;

    if (totalEvaluated > 0) {
        const scores = sortedSubs.map(s => {
            const ob = s.evaluation?.obtainedMarks || 0;
            const tot = s.evaluation?.totalMarks || 20;
            return tot > 0 ? Math.round((ob / tot) * 100) : 0;
        });

        const totalSum = scores.reduce((a, b) => a + b, 0);
        avgScorePct = Math.round(totalSum / totalEvaluated);
        highestScorePct = Math.max(...scores);

        if (totalEvaluated >= 2) {
            trendDiff = scores[scores.length - 1] - scores[0];
        }
    }

    const statEvalEl = document.getElementById("chartStatTotalEvaluated");
    const statAvgEl = document.getElementById("chartStatAvgScore");
    const statHighEl = document.getElementById("chartStatHighestScore");
    const statTrendEl = document.getElementById("chartStatTrend");

    if (statEvalEl) statEvalEl.textContent = totalEvaluated;
    if (statAvgEl) statAvgEl.textContent = totalEvaluated > 0 ? `${avgScorePct}%` : "--";
    if (statHighEl) statHighEl.textContent = totalEvaluated > 0 ? `${highestScorePct}%` : "--";
    if (statTrendEl) {
        statTrendEl.textContent = trendDiff >= 0 ? `+${trendDiff}%` : `${trendDiff}%`;
        statTrendEl.style.color = trendDiff >= 0 ? "#10b981" : "#ef4444";
    }

    if (totalEvaluated === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 2.5rem; background: var(--bg-surface); border-radius: 12px; border: 1px dashed var(--border);">
                <i class="fa-solid fa-chart-line" style="font-size: 2.5rem; color: #94a3b8; margin-bottom: 10px;"></i>
                <h4>এখনো কোনো মূল্যায়িত খাতা পাওয়া যায়নি</h4>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.25rem;">শিক্ষক আপনার খাতা মূল্যায়ন করলে এখানে অগ্রগতি ও পারফরম্যান্স গ্রাফ প্রদর্শিত হবে।</p>
                <button class="btn btn-primary" onclick="openSubmitHomeworkModal()">
                    <i class="fa-solid fa-camera"></i> খাতা জমা দিন
                </button>
            </div>
        `;
        return;
    }

    // Chart Dimensions
    const width = 600;
    const height = 240;
    const paddingLeft = 45;
    const paddingRight = 30;
    const paddingTop = 25;
    const paddingBottom = 40;

    const chartW = width - paddingLeft - paddingRight;
    const chartH = height - paddingTop - paddingBottom;

    // Grid score levels (0%, 25%, 50%, 75%, 100%)
    const gridLevels = [0, 25, 50, 75, 100];
    const gridLinesSvg = gridLevels.map(lvl => {
        const y = paddingTop + chartH - (lvl / 100) * chartH;
        return `
            <line x1="${paddingLeft}" y1="${y}" x2="${width - paddingRight}" y2="${y}" stroke="var(--border)" stroke-dasharray="3,3" stroke-width="1"/>
            <text x="${paddingLeft - 8}" y="${y + 4}" fill="var(--text-muted)" font-size="10" text-anchor="end">${lvl}%</text>
        `;
    }).join('');

    // Benchmark line at 75%
    const benchmarkY = paddingTop + chartH - (75 / 100) * chartH;
    const benchmarkSvg = `
        <line x1="${paddingLeft}" y1="${benchmarkY}" x2="${width - paddingRight}" y2="${benchmarkY}" stroke="#f59e0b" stroke-dasharray="5,4" stroke-width="1.5"/>
        <text x="${width - paddingRight}" y="${benchmarkY - 6}" fill="#f59e0b" font-size="10" text-anchor="end" font-weight="600">ক্লাস টার্গেট (৭৫%)</text>
    `;

    // Calculate student coordinates
    const points = sortedSubs.map((sub, index) => {
        const ob = sub.evaluation?.obtainedMarks || 0;
        const tot = sub.evaluation?.totalMarks || 20;
        const pct = tot > 0 ? Math.min(100, Math.round((ob / tot) * 100)) : 0;

        const x = sortedSubs.length === 1 
            ? paddingLeft + chartW / 2 
            : paddingLeft + (index / (sortedSubs.length - 1)) * chartW;
        const y = paddingTop + chartH - (pct / 100) * chartH;

        return { x, y, pct, title: sub.assignmentTitle, date: formatBanglaDateOnly(sub.submittedAt) };
    });

    const polylinePoints = points.map(p => `${p.x},${p.y}`).join(' ');

    // Area fill polygon
    const areaPoints = [
        `${points[0].x},${paddingTop + chartH}`,
        ...points.map(p => `${p.x},${p.y}`),
        `${points[points.length - 1].x},${paddingTop + chartH}`
    ].join(' ');

    const nodesSvg = points.map((p, idx) => `
        <circle cx="${p.x}" cy="${p.y}" r="5" fill="#6366f1" stroke="#ffffff" stroke-width="2"/>
        <text x="${p.x}" y="${p.y - 10}" fill="#6366f1" font-size="11" font-weight="700" text-anchor="middle">${p.pct}%</text>
        <text x="${p.x}" y="${paddingTop + chartH + 18}" fill="var(--text-muted)" font-size="10" text-anchor="middle">#${idx + 1}</text>
    `).join('');

    container.innerHTML = `
        <svg viewBox="0 0 ${width} ${height}" class="analytics-svg" style="width: 100%; max-height: 260px; overflow: visible;">
            <defs>
                <linearGradient id="scoreAreaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#6366f1" stop-opacity="0.35"/>
                    <stop offset="100%" stop-color="#6366f1" stop-opacity="0.0"/>
                </linearGradient>
            </defs>
            ${gridLinesSvg}
            ${benchmarkSvg}
            <polygon points="${areaPoints}" fill="url(#scoreAreaGradient)"/>
            <polyline points="${polylinePoints}" fill="none" stroke="#6366f1" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            ${nodesSvg}
        </svg>
    `;
}

// Window global bindings for seamless inline click accessibility
window.initTheme = initTheme;
window.toggleDarkTheme = toggleDarkTheme;
window.updateLiveNoticeAlert = updateLiveNoticeAlert;
window.dismissLiveNoticeAlert = dismissLiveNoticeAlert;
window.openLiveNoticeModal = openLiveNoticeModal;
window.loadAttendanceForSelectedDate = loadAttendanceForSelectedDate;
window.renderAttendanceGrid = renderAttendanceGrid;
window.setStudentAttendanceStatus = setStudentAttendanceStatus;
window.markAllStudentsPresent = markAllStudentsPresent;
window.saveDailyAttendance = saveDailyAttendance;
window.sendAbsentWhatsAppAlert = sendAbsentWhatsAppAlert;
window.openNewDoubtModal = openNewDoubtModal;
window.handleCreateDoubt = handleCreateDoubt;
window.renderStudentDoubts = renderStudentDoubts;
window.renderTeacherDoubts = renderTeacherDoubts;
window.openResolveDoubtModal = openResolveDoubtModal;
window.toggleDoubtVoiceRecording = toggleDoubtVoiceRecording;
window.handleSaveDoubtSolution = handleSaveDoubtSolution;
window.openAddStudyMaterialModal = openAddStudyMaterialModal;
window.toggleMaterialInputType = toggleMaterialInputType;
window.handleCreateStudyMaterial = handleCreateStudyMaterial;
window.deleteStudyMaterial = deleteStudyMaterial;
window.renderTeacherStudyMaterials = renderTeacherStudyMaterials;
window.renderStudentStudyMaterials = renderStudentStudyMaterials;
window.openCreateNoticeModal = openCreateNoticeModal;
window.handleCreateNotice = handleCreateNotice;
window.deleteNotice = deleteNotice;
window.renderTeacherNotices = renderTeacherNotices;
window.renderStudentNotices = renderStudentNotices;
window.openNoticeDetailModal = openNoticeDetailModal;
window.sendNoticeWhatsAppBroadcast = sendNoticeWhatsAppBroadcast;
window.renderStudentPerformanceChart = renderStudentPerformanceChart;
window.toggleVoiceRecording = toggleVoiceRecording;
window.discardVoiceRecording = discardVoiceRecording;
window.generateAiKhataFeedback = generateAiKhataFeedback;
window.formatKhataWhatsAppMessage = formatKhataWhatsAppMessage;
window.sendWhatsAppKhataResult = sendWhatsAppKhataResult;
window.shareEvaluatedKhataWhatsApp = shareEvaluatedKhataWhatsApp;
window.sendReportCardWhatsApp = sendReportCardWhatsApp;
window.openStudentReportCardModal = openStudentReportCardModal;
window.renderStudentBadges = renderStudentBadges;
window.openTeacherSettingsModal = openTeacherSettingsModal;
window.handleSaveTeacherSettings = handleSaveTeacherSettings;
