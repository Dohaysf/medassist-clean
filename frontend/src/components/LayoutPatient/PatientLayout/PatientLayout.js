import React, { useEffect } from 'react';
import PatientSidebar from '../PatientSidebar/PatientSidebar';
import './PatientLayout.css';

const PatientLayout = ({ children }) => {
    useEffect(() => {
        const theme = localStorage.getItem('theme') || 'light';
        document.body.className = theme === 'dark' ? 'dark-theme' : 'light-theme';
    }, []);

    return ( <
        div className = "Patient-layout" >
        <
        PatientSidebar / >
        <
        div className = "Patient-main-content" >
        <
        div className = "Patient-page-container" > { children } < /div> < /
        div > <
        /div>
    );
};

export default PatientLayout;