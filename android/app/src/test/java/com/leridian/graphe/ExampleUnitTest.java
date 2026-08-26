package com.leridian.graphe;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class ExampleUnitTest {

    @Test
    public void applicationIdIsTheGrapheNotesIdentity() {
        assertEquals("com.leridian.graphe", MainActivity.class.getPackageName());
    }
}
