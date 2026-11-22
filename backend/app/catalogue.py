from datetime import datetime

from sqlalchemy.orm import Session

from .models import Programme, University


UNIVERSITIES = [
    {
        "name": "National Institute of Technology Tiruchirappalli",
        "website": "https://www.nitt.edu/",
        "source_url": "https://www.nitt.edu/home/academics/programmes/",
        "source_title": "Academic Programmes",
        "city": "Tiruchirappalli",
        "state": "Tamil Nadu",
        "data_notes": "Official page lists undergraduate offerings. Current admission-cycle details and fee amounts remain unverified.",
    },
    {
        "name": "University of Delhi",
        "website": "https://www.du.ac.in/",
        "source_url": "https://admission.uod.ac.in/?UG-Admissions",
        "source_title": "UG Admissions 2026-27",
        "academic_year": "2026-27",
        "data_notes": "Official portal publishes UG admission notices for 2026-27. Institution type and campus location fields have not yet been checked against an official profile page.",
    },
    {
        "name": "Banaras Hindu University",
        "website": "https://www.bhu.ac.in/",
        "source_url": "https://admission.bhu.ac.in/en",
        "source_title": "Admission Portals and Application Links",
        "city": "Varanasi",
        "state": "Uttar Pradesh",
        "academic_year": "2026",
        "data_notes": "The official portal links the CUET-UG 2026 information bulletin and identifies BHU, Varanasi. The exact academic-year label and full institution metadata need confirmation.",
    },
    {
        "name": "Vellore Institute of Technology",
        "website": "https://vit.ac.in/",
        "source_url": "https://vit.ac.in/engineering-programmes-vellore-campus",
        "source_title": "B.Tech Engineering Programmes - Vellore Campus (2027-28 Admissions Open)",
        "city": "Vellore",
        "state": "Tamil Nadu",
        "academic_year": "2027-28",
        "data_notes": "Official VIT page publishes 2027-28 B.Tech offerings; adjacent VIT admissions pages contain conflicting VITEEE cycle labels, so programme criteria remain pending.",
    },
    {
        "name": "Manipal Academy of Higher Education",
        "website": "https://www.manipal.edu/",
        "source_url": "https://www.manipal.edu/admissions/admission-overview",
        "source_title": "Admissions",
        "city": "Manipal",
        "state": "Karnataka",
        "data_notes": "Official admissions page identifies MAHE and its Manipal admissions office. Current programme-specific cycle and criteria are not yet verified.",
    },
    {
        "name": "Anna University",
        "website": "https://www.annauniv.edu/",
        "source_url": "https://cfa.annauniv.edu/cfa/",
        "source_title": "Admissions 2026-27",
        "city": "Chennai",
        "state": "Tamil Nadu",
        "institution_type": "University",
        "academic_year": "2026-27",
        "verification_status": "VERIFIED",
        "data_notes": "Official Centre for Admissions page identifies Anna University, its Chennai university departments, and the 2026-27 admission cycle. Programme-specific requirements are not verified by this institution record.",
    },
    {
        "name": "Indian Institute of Science",
        "website": "https://www.iisc.ac.in/",
        "source_url": "https://www.iisc.ac.in/about/general-information/",
        "source_title": "General Information",
        "city": "Bengaluru",
        "state": "Karnataka",
        "data_notes": "Official site footer identifies the Indian Institute of Science, Bengaluru. Programme-specific admission-year data is pending.",
    },
    {
        "name": "Indian Institute of Technology Bombay",
        "website": "https://www.iitb.ac.in/",
        "source_url": "https://www.iitb.ac.in/",
        "source_title": "IIT Bombay official homepage",
        "data_notes": "Official homepage identifies IIT Bombay and carries current institute notices. Location and admission-cycle metadata have not been independently recorded here.",
    },
    {
        "name": "Indian Institute of Technology Delhi",
        "website": "https://home.iitd.ac.in/",
        "source_url": "https://home.iitd.ac.in/",
        "source_title": "About IIT Delhi",
        "data_notes": "Official homepage identifies Indian Institute of Technology Delhi. Undergraduate programme-specific admission data is pending.",
    },
    {
        "name": "Indian Institute of Technology Kanpur",
        "website": "https://www.iitk.ac.in/",
        "source_url": "https://www.iitk.ac.in/",
        "source_title": "Welcome to IIT Kanpur",
        "data_notes": "Official homepage identifies Indian Institute of Technology Kanpur. Programme-specific admission-year data is pending.",
    },
    {
        "name": "Indian Institute of Technology Hyderabad",
        "website": "https://www.iith.ac.in/",
        "source_url": "https://www.iith.ac.in/",
        "source_title": "Indian Institute of Technology Hyderabad (IITH)",
        "data_notes": "Official homepage identifies IIT Hyderabad. Programme-specific admission-year data is pending.",
    },
    {
        "name": "Indian Institute of Technology Guwahati",
        "website": "https://www.iitg.ac.in/",
        "source_url": "https://www.iitg.ac.in/",
        "source_title": "Welcome - Indian Institute of Technology Guwahati",
        "data_notes": "Official homepage identifies IIT Guwahati and lists degree types, but this record does not infer a current admissions cycle.",
    },
    {
        "name": "National Institute of Technology Karnataka, Surathkal",
        "website": "https://www.nitk.ac.in/",
        "source_url": "https://www.nitk.ac.in/",
        "source_title": "NITK Surathkal official homepage",
        "data_notes": "Official homepage identifies NITK Surathkal. UG admission criteria and current-year programme details remain pending.",
    },
    {
        "name": "National Institute of Technology Calicut",
        "website": "https://nitc.ac.in/",
        "source_url": "https://nitc.ac.in/about-us",
        "source_title": "About NITC",
        "institution_type": "National Institute of Technology",
        "state": "Kerala",
        "data_notes": "Official About page identifies NIT Calicut, its National Institute of Technology status, and Kerala location. No current programme-specific cycle is asserted.",
    },
    {
        "name": "National Institute of Technology Warangal",
        "website": "https://nitw.ac.in/",
        "source_url": "https://nitw.ac.in/",
        "source_title": "NIT Warangal official homepage",
        "data_notes": "Official homepage metadata identifies NIT Warangal. Location and current-year admissions details remain pending.",
    },
    {
        "name": "Panjab University",
        "website": "https://puchd.ac.in/",
        "source_url": "https://www.puchd.ac.in/pu-profile.php",
        "source_title": "Profile of Panjab University",
        "city": "Chandigarh",
        "state": "Chandigarh (UT)",
        "data_notes": "Official profile states the university campus is in Chandigarh. Programme-specific admission-cycle details are pending.",
    },
    {
        "name": "University of Mumbai",
        "website": "https://mu.ac.in/",
        "source_url": "https://mu.ac.in/",
        "source_title": "University of Mumbai official homepage",
        "data_notes": "Official homepage identifies the University of Mumbai and carries current notices. Campus location and programme-specific admissions have not yet been verified in this record.",
    },
    {
        "name": "Jamia Millia Islamia",
        "website": "https://www.jmi.ac.in/",
        "source_url": "https://www.jmi.ac.in/",
        "source_title": "Jamia Millia Islamia official homepage",
        "institution_type": "Public Central University",
        "city": "Delhi",
        "state": "Delhi",
        "data_notes": "Official homepage identifies Jamia Millia Islamia as a Public Central University and refers to Jamia Nagar, Delhi. Programme-specific admission-year details are pending.",
    },
    {
        "name": "Jadavpur University",
        "website": "https://jadavpuruniversity.in/",
        "source_url": "https://jadavpuruniversity.in/",
        "source_title": "Jadavpur University official homepage",
        "state": "West Bengal",
        "data_notes": "Official homepage identifies Jadavpur University and cites its state Act. Programme-specific admission-year details are pending.",
    },
    {
        "name": "Andhra University",
        "website": "https://www.andhrauniversity.edu.in/",
        "source_url": "https://www.andhrauniversity.edu.in/",
        "source_title": "Andhra University official homepage",
        "data_notes": "Official homepage identifies Andhra University and its university status. The exact campus city and programme-specific admission cycle are pending.",
    },
]


PROGRAMMES = [
    {
        "university_name": "National Institute of Technology Tiruchirappalli",
        "name": "B.Tech Chemical Engineering",
        "degree_type": "B.Tech",
        "discipline": "Chemical Engineering",
        "duration_text": "8 semesters",
        "source_url": "https://www.nitt.edu/home/academics/programmes/",
        "source_title": "Academic Programmes",
        "data_notes": "Official listing specifies Bachelor of Technology (8 semesters); the source does not identify an applicable admission year or current eligibility criteria.",
    },
    {
        "university_name": "National Institute of Technology Tiruchirappalli",
        "name": "B.Tech Civil Engineering",
        "degree_type": "B.Tech",
        "discipline": "Civil Engineering",
        "duration_text": "8 semesters",
        "source_url": "https://www.nitt.edu/home/academics/programmes/",
        "source_title": "Academic Programmes",
        "data_notes": "Official listing specifies Bachelor of Technology (8 semesters); the source does not identify an applicable admission year or current eligibility criteria.",
    },
    {
        "university_name": "National Institute of Technology Tiruchirappalli",
        "name": "B.Tech Computer Science and Engineering",
        "degree_type": "B.Tech",
        "discipline": "Computer Science and Engineering",
        "duration_text": "8 semesters",
        "source_url": "https://www.nitt.edu/home/academics/programmes/",
        "source_title": "Academic Programmes",
        "data_notes": "Official listing specifies Bachelor of Technology (8 semesters); the source does not identify an applicable admission year or current eligibility criteria.",
    },
    {
        "university_name": "National Institute of Technology Tiruchirappalli",
        "name": "B.Tech Electrical and Electronics Engineering",
        "degree_type": "B.Tech",
        "discipline": "Electrical and Electronics Engineering",
        "duration_text": "8 semesters",
        "source_url": "https://www.nitt.edu/home/academics/programmes/",
        "source_title": "Academic Programmes",
        "data_notes": "Official listing specifies Bachelor of Technology (8 semesters); the source does not identify an applicable admission year or current eligibility criteria.",
    },
    {
        "university_name": "National Institute of Technology Tiruchirappalli",
        "name": "B.Tech Electronics and Communication Engineering",
        "degree_type": "B.Tech",
        "discipline": "Electronics and Communication Engineering",
        "duration_text": "8 semesters",
        "source_url": "https://www.nitt.edu/home/academics/programmes/",
        "source_title": "Academic Programmes",
        "data_notes": "Official listing specifies Bachelor of Technology (8 semesters); the source does not identify an applicable admission year or current eligibility criteria.",
    },
    {
        "university_name": "National Institute of Technology Tiruchirappalli",
        "name": "B.Tech Instrumentation and Control Engineering",
        "degree_type": "B.Tech",
        "discipline": "Instrumentation and Control Engineering",
        "duration_text": "8 semesters",
        "source_url": "https://www.nitt.edu/home/academics/programmes/",
        "source_title": "Academic Programmes",
        "data_notes": "Official listing specifies Bachelor of Technology (8 semesters); the source does not identify an applicable admission year or current eligibility criteria.",
    },
    {
        "university_name": "National Institute of Technology Tiruchirappalli",
        "name": "B.Tech Mechanical Engineering",
        "degree_type": "B.Tech",
        "discipline": "Mechanical Engineering",
        "duration_text": "8 semesters",
        "source_url": "https://www.nitt.edu/home/academics/programmes/",
        "source_title": "Academic Programmes",
        "data_notes": "Official listing specifies Bachelor of Technology (8 semesters); the source does not identify an applicable admission year or current eligibility criteria.",
    },
    {
        "university_name": "National Institute of Technology Tiruchirappalli",
        "name": "B.Tech Metallurgical and Materials Engineering",
        "degree_type": "B.Tech",
        "discipline": "Metallurgical and Materials Engineering",
        "duration_text": "8 semesters",
        "source_url": "https://www.nitt.edu/home/academics/programmes/",
        "source_title": "Academic Programmes",
        "data_notes": "Official listing specifies Bachelor of Technology (8 semesters); the source does not identify an applicable admission year or current eligibility criteria.",
    },
    {
        "university_name": "National Institute of Technology Tiruchirappalli",
        "name": "B.Tech Production Engineering",
        "degree_type": "B.Tech",
        "discipline": "Production Engineering",
        "duration_text": "8 semesters",
        "source_url": "https://www.nitt.edu/home/academics/programmes/",
        "source_title": "Academic Programmes",
        "data_notes": "Official listing specifies Bachelor of Technology (8 semesters); the source does not identify an applicable admission year or current eligibility criteria.",
    },
    {
        "university_name": "National Institute of Technology Tiruchirappalli",
        "name": "B.Sc. B.Ed. Chemistry",
        "degree_type": "B.Sc. B.Ed.",
        "discipline": "Chemistry",
        "duration_text": "8 semesters",
        "source_url": "https://www.nitt.edu/home/academics/programmes/",
        "source_title": "Academic Programmes",
        "data_notes": "Official listing specifies B.Sc. B.Ed. (8 semesters); the source does not identify an applicable admission year or current eligibility criteria.",
    },
    {
        "university_name": "National Institute of Technology Tiruchirappalli",
        "name": "B.Sc. B.Ed. Mathematics",
        "degree_type": "B.Sc. B.Ed.",
        "discipline": "Mathematics",
        "duration_text": "8 semesters",
        "source_url": "https://www.nitt.edu/home/academics/programmes/",
        "source_title": "Academic Programmes",
        "data_notes": "Official listing specifies B.Sc. B.Ed. (8 semesters); the source does not identify an applicable admission year or current eligibility criteria.",
    },
    {
        "university_name": "National Institute of Technology Tiruchirappalli",
        "name": "B.Sc. B.Ed. Physics",
        "degree_type": "B.Sc. B.Ed.",
        "discipline": "Physics",
        "duration_text": "8 semesters",
        "source_url": "https://www.nitt.edu/home/academics/programmes/",
        "source_title": "Academic Programmes",
        "data_notes": "Official listing specifies B.Sc. B.Ed. (8 semesters); the source does not identify an applicable admission year or current eligibility criteria.",
    },
    {
        "university_name": "Vellore Institute of Technology",
        "name": "B.Tech Computer Science and Engineering",
        "degree_type": "B.Tech",
        "discipline": "Computer Science and Engineering",
        "source_url": "https://vit.ac.in/engineering-programmes-vellore-campus",
        "source_title": "B.Tech Engineering Programmes - Vellore Campus (2027-28 Admissions Open)",
        "academic_year": "2027-28",
        "data_notes": "The official page lists the programme for 2027-28, but linked admissions information states VITEEE 2026 and detailed eligibility points elsewhere. Criteria remain pending; duration and fees are not set from this source.",
    },
    {
        "university_name": "Vellore Institute of Technology",
        "name": "BCA (Bachelor of Computer Applications)",
        "degree_type": "BCA",
        "discipline": "Computer Applications",
        "duration_years": 3,
        "duration_text": "3 years",
        "minimum_percentage": 70,
        "additional_admission_conditions": [{
            "label": "At least one prescribed mathematics-related subject",
            "field": "subject_marks",
            "operator": "has_any_key",
            "value": ["Mathematics", "Business Mathematics & Statistics", "Applied Mathematics"],
        }],
        "annual_fee": 55000,
        "other_academic_fees": [{"name": "Caution Deposit", "amount": 2000, "frequency": "one-time", "refundable": True}],
        "source_url": "https://vit.ac.in/all-courses/ug/bsc-computer-science-and-bca",
        "source_title": "B.Sc. Computer Science and Bachelor of Computer Applications",
        "fee_source_url": "https://vit.ac.in/all-courses/ug/bsc-computer-science-and-bca",
        "fee_source_title": "Tuition Fees table on the BCA/B.Sc. Computer Science page",
        "data_notes": "The official page states 70% aggregate and listed alternative subjects, but its dates and fees are explicitly from 2024 and it does not identify the academic-year label. Current criteria and fees remain pending.",
        "fee_data_notes": "The source lists INR 55,000 annual tuition and a refundable INR 2,000 deposit alongside 2024 admission dates. No current academic year is assigned.",
    },
    {
        "university_name": "Vellore Institute of Technology",
        "name": "B.Sc. Computer Science",
        "degree_type": "B.Sc.",
        "discipline": "Computer Science",
        "duration_years": 3,
        "duration_text": "3 years",
        "minimum_percentage": 70,
        "additional_admission_conditions": [{
            "label": "At least one prescribed mathematics-related subject",
            "field": "subject_marks",
            "operator": "has_any_key",
            "value": ["Mathematics", "Business Mathematics & Statistics", "Applied Mathematics"],
        }],
        "annual_fee": 55000,
        "other_academic_fees": [{"name": "Caution Deposit", "amount": 2000, "frequency": "one-time", "refundable": True}],
        "source_url": "https://vit.ac.in/all-courses/ug/bsc-computer-science-and-bca",
        "source_title": "B.Sc. Computer Science and Bachelor of Computer Applications",
        "fee_source_url": "https://vit.ac.in/all-courses/ug/bsc-computer-science-and-bca",
        "fee_source_title": "Tuition Fees table on the BCA/B.Sc. Computer Science page",
        "data_notes": "The official page states 70% aggregate and listed alternative subjects, but its dates and fees are explicitly from 2024 and it does not identify the academic-year label. Current criteria and fees remain pending.",
        "fee_data_notes": "The source lists INR 55,000 annual tuition and a refundable INR 2,000 deposit alongside 2024 admission dates. No current academic year is assigned.",
    },
    {
        "university_name": "Vellore Institute of Technology",
        "name": "BBA (Bachelor of Business Administration)",
        "degree_type": "BBA",
        "discipline": "Business Administration",
        "duration_years": 3,
        "duration_text": "3 years",
        "minimum_percentage": 70,
        "additional_admission_conditions": [{
            "label": "At least one prescribed commerce/business/mathematics subject",
            "field": "subject_marks",
            "operator": "has_any_key",
            "value": ["Commerce", "Accountancy", "Book Keeping and Accountancy", "Mathematics", "Business Maths & Statistics", "Business Studies", "Business Management", "Business Economics", "Economics"],
        }],
        "annual_fee": 55000,
        "other_academic_fees": [{"name": "Caution Deposit", "amount": 2000, "frequency": "one-time", "refundable": True}],
        "source_url": "https://vit.ac.in/all-courses/ug/bachelor-commerce-bcom-and-bachelor-business-administration-bba",
        "source_title": "Bachelor of Commerce (B.Com) and Bachelor of Business Administration (BBA)",
        "fee_source_url": "https://vit.ac.in/all-courses/ug/bachelor-commerce-bcom-and-bachelor-business-administration-bba",
        "fee_source_title": "Tuition Fees table on the B.Com/BBA page",
        "data_notes": "The official page states a 70% aggregate and alternative subjects, but its admission dates and fees are from 2024 and the academic-year label is not explicit. Current criteria remain pending.",
        "fee_data_notes": "The source lists INR 55,000 annual tuition and a refundable INR 2,000 deposit alongside 2024 admission dates. No current academic year is assigned.",
    },
]


def seed_catalogue(db: Session):
    universities = {}
    now = datetime.utcnow()
    for data in UNIVERSITIES:
        university = db.query(University).filter(University.name == data["name"]).first()
        if university is None:
            values = {
                **data,
                "verification_status": data.get("verification_status", "PENDING_VERIFICATION"),
                "last_updated": now,
            }
            if values["verification_status"] == "VERIFIED":
                values["verified_at"] = now
            university = University(**values)
            db.add(university)
            db.flush()
        universities[data["name"]] = university

    for data in PROGRAMMES:
        university = universities[data["university_name"]]
        query = db.query(Programme).filter(
            Programme.university_id == university.id,
            Programme.name == data["name"],
        )
        if data.get("academic_year") is None:
            query = query.filter(Programme.academic_year.is_(None))
        else:
            query = query.filter(Programme.academic_year == data["academic_year"])
        if query.first() is not None:
            continue

        values = {
            key: value
            for key, value in data.items()
            if key != "university_name"
        }
        values.setdefault("data_status", "unverified")
        values.setdefault("verification_status", "PENDING_VERIFICATION")
        values.setdefault("fee_verification_status", "PENDING_VERIFICATION")
        values.setdefault("criteria_complete", False)
        values.setdefault("last_updated", now)
        values.setdefault("fee_last_updated", now)
        db.add(Programme(university_id=university.id, **values))

    db.commit()
